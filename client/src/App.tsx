import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './views/AuthView';
import { GameView } from './views/GameView';
import { CharacterView } from './views/CharacterView';
import { Loader2 } from 'lucide-react';

function App() {
  const { token, user, login, register, logout, isLoading } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#020402] flex items-center justify-center text-[#00ff41]">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!token || !user) {
    return <AuthView onLogin={login} onRegister={register} />;
  }

  if (!selectedCharacter) {
    return <CharacterView token={token} onSelect={setSelectedCharacter} onLogout={logout} />;
  }

  return (
    <GameView 
      token={token}
      user={user} 
      character={selectedCharacter} 
      onLogout={() => {
        setSelectedCharacter(null);
        logout();
      }} 
    />
  );
}

export default App;
