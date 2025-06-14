import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User, Bookmark } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithGoogle, signOutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function AuthButton() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      // User will be redirected for Google auth
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      let description = "Could not sign in with Google. Please try again.";
      if (error.code === 'auth/unauthorized-domain') {
        description = "Domain not authorized. Please add your Replit domain to Firebase authorized domains in the Firebase Console.";
      }
      
      toast({
        title: "Sign In Failed",
        description,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/bookmarks">
          <Button variant="ghost" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Bookmarks</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || 'User'} 
            className="w-6 h-6 rounded-full"
          />
          <span className="hidden sm:inline text-slate-600">
            {user.displayName || user.email}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignIn}>
      <LogIn className="h-4 w-4 mr-2" />
      Sign In
    </Button>
  );
}