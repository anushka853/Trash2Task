import React, { createContext, useState, useEffect } from 'react';

export const GlobalContext = createContext();

const API_BASE_URL = 'https://trash2task.onrender.com/api';


export const GlobalProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('civicpulse_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);

  // Set auth header token helper
  const getAuthHeaders = () => {
    if (user && user.token) {
      return {
        'Authorization': `Bearer ${user.token}`,
      };
    }
    return {};
  };

  // Login action
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      
      setUser(data);
      localStorage.setItem('civicpulse_user', JSON.stringify(data));
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Register action
  const signup = async (name, email, password, role = 'Citizen') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setUser(data);
      localStorage.setItem('civicpulse_user', JSON.stringify(data));
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout action
  const logout = () => {
    setUser(null);
    localStorage.removeItem('civicpulse_user');
  };

  // Fetch all issues
  const fetchIssues = async (filters = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const res = await fetch(`${API_BASE_URL}/issues?${queryParams}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch issues');
      setIssues(data);
    } catch (err) {
      console.error('Fetch issues error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get single issue details
  const fetchIssueById = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch issue details');
      return data;
    } catch (err) {
      console.error('Fetch issue by id error:', err);
      throw err;
    }
  };

  // Fetch dashboard analytics
  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/analytics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch analytics');
      setAnalytics(data);
      return data;
    } catch (err) {
      console.error('Fetch analytics error:', err);
    }
  };

  // Pre-analyze reported photo using Gemini
  const preAnalyzeImage = async (formData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/analyze`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData, // Multer form file body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'AI analysis failed');
      return data;
    } catch (err) {
      console.error('Image analysis error:', err);
      throw err;
    }
  };

  // Create issue report
  const submitIssue = async (issueData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit issue');
      
      // Refresh issues lists
      fetchIssues();
      // Update local user points details
      refreshUserProfile();
      return { success: true, data };
    } catch (err) {
      console.error('Submit issue error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Verify / Upvote/Downvote issue
  const verifyIssue = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/verify`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to verify issue');
      
      // Update local issues lists
      setIssues(prev => prev.map(issue => issue._id === id ? { ...issue, ...data } : issue));
      refreshUserProfile();
      return data;
    } catch (err) {
      console.error('Verify issue error:', err);
      throw err;
    }
  };

  // Resolve issue (Admin resolution verification)
  const resolveIssue = async (id, formData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/resolve`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData, // Multer form data (contains resolutionImage file)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'AI resolution verification failed');

      // Refresh list
      fetchIssues();
      refreshUserProfile();
      return { success: true, data };
    } catch (err) {
      console.error('Resolve issue error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Refresh current user scores/badges
  const refreshUserProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem('civicpulse_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Refresh profile error:', err);
    }
  };

  // Get leaderboard
  const getLeaderboard = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/leaderboard`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch leaderboard');
      return data;
    } catch (err) {
      console.error('Get leaderboard error:', err);
      return [];
    }
  };

  // Fetch dynamic activities/notifications
  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/issues/activities`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch activities');
      setActivities(data);
      return data;
    } catch (err) {
      console.error('Fetch activities error:', err);
    }
  };

  // Staff checks-in near coordinate
  const checkInStaff = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/check-in`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to check-in');
      
      setIssues(prev => prev.map(issue => issue._id === id ? { ...issue, ...data } : issue));
      return { success: true, data };
    } catch (err) {
      console.error('Check-in error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Staff completes issue
  const completeStaffIssue = async (id, formData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/complete`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit completion proof');

      setIssues(prev => prev.map(issue => issue._id === id ? { ...issue, ...data } : issue));
      return { success: true, data };
    } catch (err) {
      console.error('Complete issue error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Admin assigns staff
  const assignIssue = async (id, staffId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/assign`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staffId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to assign issue');

      fetchIssues();
      return { success: true, data };
    } catch (err) {
      console.error('Assign issue error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Admin merges duplicate issues
  const mergeIssues = async (id, duplicateId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/merge`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duplicateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to merge issues');

      fetchIssues();
      return { success: true, data };
    } catch (err) {
      console.error('Merge issues error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Fetch Working Staff list
  const fetchStaffUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/staff`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setStaffUsers(data);
      }
    } catch (err) {
      console.error('Fetch staff users error:', err);
    }
  };

  // Refresh profile details on startup if user is logged in
  useEffect(() => {
    if (user) {
      refreshUserProfile();
    }
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        user,
        issues,
        loading,
        analytics,
        activities,
        login,
        signup,
        logout,
        fetchIssues,
        fetchIssueById,
        fetchAnalytics,
        preAnalyzeImage,
        submitIssue,
        verifyIssue,
        resolveIssue,
        getLeaderboard,
        refreshUserProfile,
        fetchActivities,
        checkInStaff,
        completeStaffIssue,
        assignIssue,
        mergeIssues,
        staffUsers,
        fetchStaffUsers,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
