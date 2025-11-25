// client/src/App.tsx
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useGameStore } from './store/useGameStore';
import { LobbyScreen } from './screens/LobbyScreen';
import { SetupScreen } from './screens/SetupScreen';
import { BattleScreen } from './screens/BattleScreen';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Trophy, RefreshCw } from 'lucide-react';

function App() {
  const { status, winner, winReason, reset, playerId } = useGameStore();

  // --- Game Ended Screen ---
  if (status === 'ENDED') {
    const isWinner = winner && playerId && winner === playerId;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          {isWinner ? (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
            </>
          ) : (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl" />
            </>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-12 text-center max-w-lg"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            {isWinner ? (
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/50 mb-4">
                <Trophy className="w-12 h-12 text-slate-900" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg mb-4">
                <Anchor className="w-12 h-12 text-slate-400" />
              </div>
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`text-4xl font-bold mb-4 ${
              isWinner
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500'
                : 'text-slate-400'
            }`}
          >
            {isWinner ? 'CHIẾN THẮNG!' : 'TRẬN ĐẤU KẾT THÚC'}
          </motion.h1>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-3 mb-8"
          >
            <div className="text-slate-300 text-lg">
              Người chiến thắng:{' '}
              <span className={isWinner ? 'text-yellow-400 font-bold' : 'text-red-400 font-bold'}>
                {winner || 'Không xác định'}
              </span>
            </div>
            {winReason && (
              <div className="text-slate-500 text-sm">
                Lý do: {winReason}
              </div>
            )}
          </motion.div>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 font-bold rounded-xl hover:from-cyan-400 hover:to-emerald-400 transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            VỀ TRANG CHỦ
          </motion.button>
        </motion.div>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
            },
          }}
        />
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {(status === 'IDLE' || status === 'LOBBY') && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LobbyScreen />
          </motion.div>
        )}

        {status === 'SETUP' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SetupScreen />
          </motion.div>
        )}

        {status === 'BATTLE' && (
          <motion.div
            key="battle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BattleScreen />
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            fontFamily: 'JetBrains Mono, monospace',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1e293b',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1e293b',
            },
          },
        }}
      />
    </>
  );
}

export default App;
