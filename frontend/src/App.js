import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthCallback } from "@/components/AuthCallback";
import { AiraLoader } from "@/components/AiraAvatar";

import Landing from "@/pages/Landing";
import About from "@/pages/About";
import MeetAira from "@/pages/MeetAira";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import Contact from "@/pages/Contact";

const Analysis = lazy(() => import("@/pages/Analysis"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Recommendations = lazy(() => import("@/pages/Recommendations"));
const Report = lazy(() => import("@/pages/Report"));
const Simulator = lazy(() => import("@/pages/Simulator"));
const Chat = lazy(() => import("@/pages/Chat"));
const Profile = lazy(() => import("@/pages/Profile"));

const guard = (el) => <ProtectedRoute>{el}</ProtectedRoute>;

function Shell() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <>
      <div className="bg-glow-1" />
      <div className="bg-glow-2" />
      <div className="bg-grain" />
      <Header />
      <main className="main-content" id="main-content">
        <Suspense fallback={<AiraLoader label="Loading module" step="Preparing interface…" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/meet-aira" element={<MeetAira />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/simulator" element={guard(<Simulator />)} />
            <Route path="/analysis" element={guard(<Analysis />)} />
            <Route path="/dashboard" element={guard(<Dashboard />)} />
            <Route path="/recommendations" element={guard(<Recommendations />)} />
            <Route path="/report" element={guard(<Report />)} />
            <Route path="/chat" element={guard(<Chat />)} />
            <Route path="/profile" element={guard(<Profile />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Shell />
          <Toaster theme="dark" position="top-right" richColors />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
