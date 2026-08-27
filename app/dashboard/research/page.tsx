'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ResearchFamily, ResearchBook } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Beaker, Users, TrendingUp, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';

const BOOK_LABELS: Record<ResearchBook, string> = {
  'day-trade': 'Day Trade',
  'swing': 'Swing',
  'position': 'Position',
  'orb': 'ORB',
  'news': 'News',
};

const BOOK_ORDER: ResearchBook[] = ['day-trade', 'swing', 'position', 'orb', 'news'];

export default function ResearchPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<ResearchFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<ResearchBook | 'all'>('all');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'research-families'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const familiesData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
        } as ResearchFamily;
      });
      setFamilies(familiesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredFamilies = selectedBook === 'all' 
    ? families 
    : families.filter(f => f.book === selectedBook);

  const familiesByBook = BOOK_ORDER.reduce((acc, book) => {
    acc[book] = families.filter(f => f.book === book);
    return acc;
  }, {} as Record<ResearchBook, ResearchFamily[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Research</h1>
          <p className="text-gray-400">Monitor-only: experiment families by trading book</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSelectedBook('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedBook === 'all'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {BOOK_ORDER.map((book) => (
            <button
              key={book}
              onClick={() => setSelectedBook(book)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedBook === book
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {BOOK_LABELS[book]}
            </button>
          ))}
        </div>
      </div>

      {/* Book Sections */}
      {selectedBook === 'all' ? (
        <div className="space-y-8">
          {BOOK_ORDER.map((book) => (
            <BookSection
              key={book}
              book={book}
              label={BOOK_LABELS[book]}
              families={familiesByBook[book]}
            />
          ))}
        </div>
      ) : (
        <BookSection
          book={selectedBook}
          label={BOOK_LABELS[selectedBook]}
          families={filteredFamilies}
        />
      )}
    </div>
  );
}

function BookSection({ 
  book, 
  label, 
  families 
}: { 
  book: ResearchBook; 
  label: string; 
  families: ResearchFamily[];
}) {
  const newsDescription = book === 'news' 
    ? 'Keyword buckets, not NLP; headlines are gates, never auto-traded.'
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-white">{label}</h2>
        <span className="px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-sm font-medium">
          {families.length} {families.length === 1 ? 'family' : 'families'}
        </span>
      </div>
      
      {newsDescription && (
        <p className="text-sm text-gray-500 italic">{newsDescription}</p>
      )}

      {families.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
          <Beaker className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No families in this book yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {families.map((family) => (
            <FamilyCard key={family.id} family={family} />
          ))}
        </div>
      )}
    </div>
  );
}

function FamilyCard({ family }: { family: ResearchFamily }) {
  const formatDate = (date: Date | undefined) => {
    if (!date) return null;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/New_York'
    });
  };

  return (
    <Link href={`/dashboard/research/detail?id=${family.id}`}>
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl hover:border-gray-600 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{family.name}</h3>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
            {BOOK_LABELS[family.book]}
          </span>
        </div>

        <div className="space-y-3">
          {family.champion && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">Champion: {family.champion}</span>
            </div>
          )}

          {family.lastHoldoutEndingDollar !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">
                Last holdout: {formatCurrency(family.lastHoldoutEndingDollar)}
              </span>
            </div>
          )}

          {family.generationCount !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Beaker className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">
                {family.generationCount} {family.generationCount === 1 ? 'generation' : 'generations'}
              </span>
            </div>
          )}

          {(family.startDate || family.endDate) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">
                {formatDate(family.startDate)} - {formatDate(family.endDate) || 'ongoing'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
