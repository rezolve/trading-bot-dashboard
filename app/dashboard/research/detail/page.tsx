'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ResearchFamily, ResearchExperiment, ResearchIdea, ResearchBook } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Beaker, Lightbulb, TrendingUp, Calendar, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const BOOK_LABELS: Record<ResearchBook, string> = {
  'day-trade': 'Day Trade',
  'swing': 'Swing',
  'position': 'Position',
  'orb': 'ORB',
  'news': 'News',
};

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-400',
  running: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  tested: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  implemented: 'bg-blue-500/20 text-blue-400',
};

export default function FamilyDetailPage() {
  const searchParams = useSearchParams();
  const familyId = searchParams.get('id');
  const { user } = useAuth();
  const [family, setFamily] = useState<ResearchFamily | null>(null);
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [ideas, setIdeas] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !familyId) {
      setLoading(false);
      return;
    }

    const familyUnsubscribe = onSnapshot(
      doc(db, 'research-families', familyId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFamily({
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
          } as ResearchFamily);
        }
        setLoading(false);
      }
    );

    const experimentsQuery = query(
      collection(db, 'research-experiments'),
      where('familyId', '==', familyId),
      orderBy('generation', 'desc')
    );

    const experimentsUnsubscribe = onSnapshot(experimentsQuery, (snapshot) => {
      const experimentsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as ResearchExperiment;
      });
      setExperiments(experimentsData);
    });

    const ideasQuery = query(
      collection(db, 'research-ideas'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );

    const ideasUnsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as ResearchIdea;
      });
      setIdeas(ideasData);
    });

    return () => {
      familyUnsubscribe();
      experimentsUnsubscribe();
      ideasUnsubscribe();
    };
  }, [user, familyId]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return null;
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  };

  const formatDateShort = (date: Date | undefined) => {
    if (!date) return null;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/New_York'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!familyId || !family) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Family not found</p>
        <Link href="/dashboard/research" className="text-blue-400 hover:text-blue-300">
          Back to Research
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link 
          href="/dashboard/research"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Research
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{family.name}</h1>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                {BOOK_LABELS[family.book]}
              </span>
            </div>
            <p className="text-gray-400">Monitor-only: experiments and ideas</p>
          </div>
        </div>
      </div>

      {/* Family Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {family.champion && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-gray-400 text-sm">Champion</p>
            </div>
            <p className="text-xl font-bold text-white">{family.champion}</p>
          </div>
        )}

        {family.lastHoldoutEndingDollar !== undefined && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <p className="text-gray-400 text-sm">Last Holdout</p>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(family.lastHoldoutEndingDollar)}
            </p>
          </div>
        )}

        {family.generationCount !== undefined && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="w-4 h-4 text-gray-400" />
              <p className="text-gray-400 text-sm">Generations</p>
            </div>
            <p className="text-xl font-bold text-white">{family.generationCount}</p>
          </div>
        )}

        {(family.startDate || family.endDate) && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <p className="text-gray-400 text-sm">Period</p>
            </div>
            <p className="text-sm font-medium text-white">
              {formatDateShort(family.startDate)} - {formatDateShort(family.endDate) || 'ongoing'}
            </p>
          </div>
        )}
      </div>

      {/* Experiments Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Experiments</h2>
        </div>
        
        {experiments.length === 0 ? (
          <div className="p-12 text-center">
            <Beaker className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No experiments yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Generation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {experiments.map((experiment) => (
                  <tr key={experiment.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-white">Gen {experiment.generation}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[experiment.status]}`}>
                        {experiment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(experiment.startedAt) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(experiment.completedAt) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ideas Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Ideas</h2>
        </div>
        
        {ideas.length === 0 ? (
          <div className="p-12 text-center">
            <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No ideas yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {ideas.map((idea) => (
                  <tr key={idea.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {idea.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[idea.status]}`}>
                        {idea.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(idea.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
