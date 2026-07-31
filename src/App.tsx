import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RunnerPage from "./pages/RunnerPage";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/runner" element={<RunnerPage />} />
    </Routes>
  );
}