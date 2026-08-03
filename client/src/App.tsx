import { lazy, Suspense, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './views/AuthView';
import { CharacterView } from './views/CharacterView';
import { Loader2 } from 'lucide-react';
import type { Character } from './types';

const GameView = lazy(() =>
  import('./views/GameView').then(({ GameView }) => ({ default: GameView })),
);
const AdminSnapshotView = lazy(() =>
  import('./views/AdminSnapshotView').then(({ AdminSnapshotView }) => ({
    default: AdminSnapshotView,
  })),
);

function LoadingView() {
  return (
    <div className="h-screen w-screen bg-[#020402] flex items-center justify-center text-[#00ff41]">
      <Loader2 className="animate-spin" size={48} />
    </div>
  );
}

function App() {
  const { token, user, login, register, logout, isLoading } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  if (isLoading) {
    return <LoadingView />;
  }

  if (!token || !user) {
    return <AuthView onLogin={login} onRegister={register} />;
  }

  if (showAdmin && user.isAdmin) {
    return (
      <Suspense fallback={<LoadingView />}>
        <AdminSnapshotView
          token={token}
          onBack={() => setShowAdmin(false)}
          onLogout={() => {
            setShowAdmin(false);
            logout();
          }}
        />
      </Suspense>
    );
  }

  if (!selectedCharacter) {
    return (
      <CharacterView
        token={token}
        isAdmin={user.isAdmin}
        onOpenAdmin={() => setShowAdmin(true)}
        onSelect={setSelectedCharacter}
        onLogout={logout}
      />
    );
  }

  return (
    <Suspense fallback={<LoadingView />}>
      <GameView
        key={`${selectedCharacter.id}:${token}`}
        token={token}
        character={selectedCharacter}
        onLogout={() => {
          setSelectedCharacter(null);
          logout();
        }}
      />
    </Suspense>
  );
}

export default App;
