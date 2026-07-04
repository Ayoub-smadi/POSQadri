import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey, Employee } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: Employee | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useGetCurrentUser<Employee>({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
    },
  });
  
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        refetch();
        setLocation("/login");
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
