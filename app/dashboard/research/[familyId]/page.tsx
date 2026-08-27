'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ResearchFamily, ResearchExperiment, ResearchIdea, BacktestRun } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, FlaskConical, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatReturnCurrency, formatReturnPercent } from '@/lib/backtest-display';

// For static export: resolve familyId from URL path
function getRealFamilyId(): string | null {
  if (typeof window === 'undefined') return null;
  const segments = window.location.pathname.split('/').filter(Boolean);
  const researchIndex = segments.indexOf('research');
  if (researchIndex >= 0 && segments.length > researchIndex + 1) {
    const id = segments[researchIndex + 1];
    return id === '_' ? null : id;
  }
  return null;
}

export default function ResearchFamilyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<ResearchFamily | null>(null);
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [ideas, setIdeas] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve real familyId from URL path (ignore '_' from generateStaticParams)
  useEffect(() => {
    const realFamilyId = getRealFamilyId();
    if (realFamilyId) {
      setFamilyId(realFamilyId);
    } else {
      const paramFamilyId = params.familyId as string;
      if (paramFamilyId && paramFamilyId !== '_') {
        setFamilyId(paramFamilyId);
      }
    }
  }, [params.familyId]);

  useEffect(() => {
    if (!user || !familyId || familyId === '_') return;

    const loadFamily = async () => {
      const familyDoc = await getDoc(doc(db, 'research-families', familyId));
      if (familyDoc.exists()) {
        const data = familyDoc.data();
        if (data.userId !== user.uid) {
          setFamily(null);
          setLoading(false);
          return;
        }
        setFamily({
          ...data,
          familyId: familyDoc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ResearchFamily);
      }
      setLoading(false);
    };

    loadFamily();

    // Subscribe to experiments
    const experimentsQuery = query(
      collection(db, 'research-experiments'),
      where('userId', '==', user.uid),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );
    const unsubExperiments = onSnapshot(experimentsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        experimentId: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
        inSampleStart: doc.data().inSampleStart?.toDate(),
        inSampleEnd: doc.data().inSampleEnd?.toDate(),
        holdoutStart: doc.data().holdoutStart?.toDate(),
        holdoutEnd: doc.data().holdoutEnd?.toDate(),
      } as ResearchExperiment));
      setExperiments(data);
    });

    // Subscribe to ideas
    const ideasQuery = query(
      collection(db, 'research-ideas'),
      where('userId', '==', user.uid),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );
    const unsubIdeas = onSnapshot(ideasQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        ideaId: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as ResearchIdea));
      setIdeas(data);
    });

    return () => {
      unsubExperiments();
      unsubIdeas();
    };
  }, [user, familyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Family Not Found</h2>
        <button
          onClick={() => router.push('/dashboard/research')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Back to Research
        </button>
      </div>
    );
  }

  // Calculate in-sample vs holdout gap for latest experiment
  const latestScored = experiments.find((exp) => exp.status === 'scored' || exp.status === 'kept');
  const overfitGap = latestScored && latestScored.inSampleReturnPercent !== undefined && latestScored.holdoutReturnPercent !== undefined
    ? latestScored.inSampleReturnPercent - latestScored.holdoutReturnPercent
    : null;

  // Prepare chart data (scored experiments only)
  const chartData = experiments
    .filter((exp) => exp.generation !== undefined && exp.holdoutReturnPercent !== undefined)
    .sort((a, b) => (a.generation || 0) - (b.generation || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{family.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="capitalize">{family.book}</span>
              <span>•</span>
              <span className="capitalize">{family.assetClass}</span>
              <span>•</span>
              <span className="capitalize">{family.side}</span>
              {!family.holdsOvernight && (
                <>
                  <span>•</span>
                  <span>Intraday</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Champion */}
      {family.championBotId && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-2">Champion Bot</p>
          <p className="text-blue-400 font-medium">{family.championBotId}</p>
        </div>
      )}

      {/* Overfit Detector */}
      {overfitGap !== null && (
        <div className={`border rounded-lg p-4 ${
          Math.abs(overfitGap) > 5
            ? 'bg-yellow-900/20 border-yellow-500/30'
            : 'bg-gray-900 border-gray-800'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              Math.abs(overfitGap) > 5 ? 'text-yellow-400' : 'text-gray-400'
            }`} />
            <div>
              <p className="font-semibold text-white mb-1">In-Sample vs Holdout Gap</p>
              <p className="text-sm text-gray-300">
                Latest experiment: IS {latestScored?.inSampleReturnPercent?.toFixed(2)}% vs OOS {latestScored?.holdoutReturnPercent?.toFixed(2)}%
              </p>
              <p className={`text-sm font-semibold mt-1 ${
                Math.abs(overfitGap) > 5 ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                Gap: {overfitGap > 0 ? '+' : ''}{overfitGap.toFixed(2)}%
                {Math.abs(overfitGap) > 5 && ' (potential overfit)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evolution Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            Performance Evolution
          </h3>
          <div className="relative" style={{ height: '300px' }}>
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Simple line chart */}
              {(() => {
                const padding = 40;
                const width = 800;
                const height = 300;
                const dataWidth = width - padding * 2;
                const dataHeight = height - padding * 2;

                const maxGen = Math.max(...chartData.map((d) => d.generation || 0));
                const minReturn = Math.min(...chartData.map((d) => d.holdoutReturnPercent || 0));
                const maxReturn = Math.max(...chartData.map((d) => d.holdoutReturnPercent || 0));
                const returnRange = maxReturn - minReturn || 1;

                const points = chartData.map((exp) => {
                  const x = padding + ((exp.generation || 0) / maxGen) * dataWidth;
                  const y = height - padding - (((exp.holdoutReturnPercent || 0) - minReturn) / returnRange) * dataHeight;
                  return { x, y, exp };
                });

                const pathD = points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ');

                return (
                  <>
                    {/* Axes */}
                    <line
                      x1={padding}
                      y1={height - padding}
                      x2={width - padding}
                      y2={height - padding}
                      stroke="#374151"
                      strokeWidth="2"
                    />
                    <line
                      x1={padding}
                      y1={padding}
                      x2={padding}
                      y2={height - padding}
                      stroke="#374151"
                      strokeWidth="2"
                    />

                    {/* Line */}
                    <path d={pathD} stroke="#3B82F6" strokeWidth="2" fill="none" />

                    {/* Points */}
                    {points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill={p.exp.status === 'kept' ? '#10B981' : '#6B7280'}
                        stroke="#1F2937"
                        strokeWidth="2"
                      />
                    ))}

                    {/* Labels */}
                    <text x={padding} y={height - 10} fill="#9CA3AF" fontSize="12">
                      Gen 0
                    </text>
                    <text x={width - padding} y={height - 10} fill="#9CA3AF" fontSize="12" textAnchor="end">
                      Gen {maxGen}
                    </text>
                    <text x={10} y={padding} fill="#9CA3AF" fontSize="12">
                      {maxReturn.toFixed(1)}%
                    </text>
                    <text x={10} y={height - padding} fill="#9CA3AF" fontSize="12">
                      {minReturn.toFixed(1)}%
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            X = Generation • Y = Holdout Return % • Green = Kept • Gray = Scored
          </p>
        </div>
      )}

      {/* Experiments Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-purple-400" />
          Experiments
        </h3>

        {experiments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No experiments yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Hypothesis</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Tweak</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">IS %</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">OOS %</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr key={exp.experimentId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4 text-white">{exp.hypothesis}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {Object.keys(exp.tweak).slice(0, 2).join(', ')}
                      {Object.keys(exp.tweak).length > 2 && '...'}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {exp.inSampleReturnPercent !== undefined
                        ? formatReturnPercent(exp.inSampleReturnPercent)
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      {exp.holdoutReturnPercent !== undefined
                        ? formatReturnPercent(exp.holdoutReturnPercent)
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        exp.status === 'kept' ? 'bg-green-500/20 text-green-400' :
                        exp.status === 'killed' ? 'bg-red-500/20 text-red-400' :
                        exp.status === 'scored' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ideas Table */}
      {ideas.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Ideas</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Source</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Param Diff</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Critic</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ideas.map((idea) => (
                  <tr key={idea.ideaId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4 text-blue-400 text-xs truncate max-w-xs">
                      {idea.sourceUrl || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {idea.paramDiff ? Object.keys(idea.paramDiff).slice(0, 2).join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        idea.critic === 'keep' ? 'bg-green-500/20 text-green-400' :
                        idea.critic === 'kill' ? 'bg-red-500/20 text-red-400' :
                        idea.critic === 'rewrite' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {idea.critic || 'pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-400 capitalize">
                      {idea.status.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
