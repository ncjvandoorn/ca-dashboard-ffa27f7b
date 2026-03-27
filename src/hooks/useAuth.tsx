import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "user" | "customer";

interface CustomerAccountInfo {
  customerAccountId: string;
  canSeeTrials: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  role: AppRole | null;
  customerAccount: CustomerAccountInfo | null;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [customerAccount, setCustomerAccount] = useState<CustomerAccountInfo | null>(null);

  const fetchRoleAndCustomer = async (userId: string) => {
    // Fetch role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const userRole = (roleData?.role as AppRole) || null;
    setRole(userRole);

    // Fetch customer account info if customer
    if (userRole === "customer") {
      const { data: caData } = await supabase
        .from("customer_accounts")
        .select("customer_account_id, can_see_trials")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (caData) {
        setCustomerAccount({
          customerAccountId: caData.customer_account_id,
          canSeeTrials: caData.can_see_trials ?? false,
        });
      } else {
        setCustomerAccount(null);
      }
    } else {
      setCustomerAccount(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid Supabase deadlock
        setTimeout(() => fetchRoleAndCustomer(session.user.id), 0);
      } else {
        setRole(null);
        setCustomerAccount(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoleAndCustomer(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    const email = `${username}@chrysal.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Log the login event
    if (!error && data?.user) {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-login`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ userId: data.user.id, email }),
        }).catch(() => {});
      } catch {}
    }
    
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const isAdmin = role === "admin";
  const isCustomer = role === "customer";

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isCustomer, role, customerAccount, signIn, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
