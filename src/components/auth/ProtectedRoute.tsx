// src/components/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  allowedRoles: ('admin' | 'employee')[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Authenticating...</div>;
  }

  // Check 1: Is the user logged in?
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Check 2: Does the user's role match one of the allowed roles?
  const hasAccess = allowedRoles.includes(profile.role);

  if (!hasAccess) {
    // If they don't have access, send them to a page they CAN access.
    // The dashboard is a safe default.
    // You could also create a dedicated "Unauthorized" page.
    alert("You do not have permission to access this page.");
    return <Navigate to="/dashboard" replace />;
  }

  // If both checks pass, render the nested content.
  // The <Layout> component should be composed in the router configuration,
  // not directly within this component.
  return <Outlet />;
};