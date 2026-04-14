import "@testing-library/jest-dom/jest-globals";

const globalWithApi = globalThis as typeof globalThis & {
  __VITE_API_BASE_URL__?: string;
};

globalWithApi.__VITE_API_BASE_URL__ = "http://localhost:4000";
