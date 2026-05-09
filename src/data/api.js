// Bu dosyayı PMS-frontend-main/src/api.js olarak kaydet

const BASE_URL = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("pms_token");
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Bir hata oluştu");
  return data;
}

// AUTH
export const login = (email, password) =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

// PROJECTS
export const getProjects = (search = "") =>
  request(`/projects${search ? `?search=${search}` : ""}`);

export const createProject = (form) =>
  request("/projects", { method: "POST", body: JSON.stringify(form) });

// ADVISORS
export const getAdvisors = (search = "") =>
  request(`/advisors${search ? `?search=${search}` : ""}`);

export const sendAdvisorRequest = (advisorId, projectId) =>
  request(`/advisors/${advisorId}/request`, {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });

// REQUESTS (danışman için)
export const getRequests = () => request("/requests");

export const updateRequest = (id, status) =>
  request(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// ANNOUNCEMENTS
export const getAnnouncements = () => request("/announcements");

export const createAnnouncement = (form) =>
  request("/announcements", { method: "POST", body: JSON.stringify(form) });

// USERS
export const getStudents = () => request("/users/students");
export const getMe = () => request("/users/me");
