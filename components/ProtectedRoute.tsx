import React, { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('master' | 'student')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    // Basic loading spinner while checking auth
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="size-8 border-4 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

export default memo(ProtectedRoute);