import { useState, useEffect } from 'react';

// Dynamic API Base URL (Works locally and on Vercel deployment)
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://ai-job-aggregator-backend-yn8i.onrender.com';

function App() {
  const [view, setView] = useState('login'); 
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);

  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [skills, setSkills] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');

  const [stats, setStats] = useState({
    totalJobs: 0,
    recommendedJobs: 0,
    savedJobs: 0,
    appliedJobs: 0,
    avgMatchScore: 0
  });

  const fetchDashboardStats = async (userEmail = user?.email, userSkills = skills) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, userSkills }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats(user.email, skills);
    }
  }, [user, skills]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Registration Successful! Please login.');
        setView('login');
      } else {
        setMessage(data.error || 'Registration failed');
      }
    } catch (err) {
      setMessage('Server connection error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setView('dashboard');
      } else {
        setMessage(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setMessage('Error connecting to backend');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload-resume`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setMessage('Resume uploaded successfully!');
        setExtractedText(data.extractedText || '');
      } else {
        setMessage(data.error || 'Failed to extract text from resume');
      }
    } catch (err) {
      setMessage('Error uploading file. Make sure backend node server is running.');
    }
  };

  const handleExtractSkills = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/extract-skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText }),
      });
      const data = await res.json();
      if (res.ok) {
        const extractedSkills = data.skills || [];
        setSkills(extractedSkills);
        setMessage(`Extracted ${extractedSkills.length} skills! Now click "Find Matching Jobs".`);
      } else {
        setMessage(data.error || 'Failed to extract skills');
      }
    } catch (err) {
      setMessage('Error extracting skills');
    }
  };

  const handleCollectJobs = async () => {
    setMessage('Collecting live jobs from external sources...');
    try {
      const res = await fetch(`${API_BASE_URL}/collect-jobs`, { method: 'POST' });
      const data = await res.json();
      setMessage(data.message || 'Jobs populated successfully!');
      fetchDashboardStats(user?.email, skills);
    } catch (err) {
      setMessage('Error connecting to job collection endpoint');
    }
  };

  const handleMatchJobs = async () => {
    console.log("Triggering Find Matching Jobs with skills:", skills);
    
    let currentSkills = skills;
    if ((!currentSkills || currentSkills.length === 0) && extractedText) {
      currentSkills = ["React", "Web Developer"];
    }

    if (!currentSkills || currentSkills.length === 0) {
      alert('No skills detected! Click "Extract Skills" first.');
      return;
    }

    try {
      setMessage('Finding matching jobs...');
      const res = await fetch(`${API_BASE_URL}/match-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userSkills: currentSkills }),
      });
      
      const data = await res.json();
      console.log("Response received from backend:", data);

      if (res.ok) {
        const matchedList = data.jobs || [];
        setJobs(matchedList);
        if (matchedList.length === 0) {
          setMessage('No matching jobs found in database. Click "Sync / Collect External Jobs" first!');
        } else {
          setMessage(`Found ${matchedList.length} matching jobs!`);
        }
        fetchDashboardStats(user?.email, currentSkills);
      } else {
        setMessage(data.error || 'Failed to fetch matching jobs');
      }
    } catch (err) {
      console.error("Match error:", err);
      setMessage('Error matching jobs. Ensure backend is active at port 5000.');
    }
  };

  const handleJobAction = async (jobId, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user-job-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email, jobId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchDashboardStats(user.email, skills);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '30px', fontFamily: 'sans-serif', paddingBottom: '60px' }}>
      {view === 'register' && (
        <div>
          <h2>Register</h2>
          <form onSubmit={handleRegister}>
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required /><br /><br />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><br /><br />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><br /><br />
            <button type="submit">Register</button>
          </form>
          <p>{message}</p>
          <button onClick={() => setView('login')}>Already have an account? Login</button>
        </div>
      )}

      {view === 'login' && (
        <div>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><br /><br />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><br /><br />
            <button type="submit">Login</button>
          </form>
          <p>{message}</p>
          <button onClick={() => setView('register')}>Need an account? Register</button>
        </div>
      )}

      {view === 'dashboard' && (
        <div>
          <h1>Welcome, {user?.name || 'User'}!</h1>
          <h3>AI Job Aggregator & Matching Engine</h3>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', margin: '20px auto', maxWidth: '850px' }}>
            <div style={{ background: '#007bff', color: '#fff', padding: '15px 20px', borderRadius: '8px', minWidth: '120px' }}>
              <h3 style={{ margin: 0 }}>{stats.totalJobs}</h3>
              <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Total Jobs</p>
            </div>
            <div style={{ background: '#28a745', color: '#fff', padding: '15px 20px', borderRadius: '8px', minWidth: '120px' }}>
              <h3 style={{ margin: 0 }}>{stats.recommendedJobs}</h3>
              <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Recommended</p>
            </div>
            <div style={{ background: '#ffc107', color: '#000', padding: '15px 20px', borderRadius: '8px', minWidth: '120px' }}>
              <h3 style={{ margin: 0 }}>{stats.savedJobs}</h3>
              <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Saved Jobs</p>
            </div>
            <div style={{ background: '#17a2b8', color: '#fff', padding: '15px 20px', borderRadius: '8px', minWidth: '120px' }}>
              <h3 style={{ margin: 0 }}>{stats.appliedJobs}</h3>
              <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Applied Jobs</p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={handleCollectJobs} 
              style={{ padding: '10px 18px', backgroundColor: '#343a40', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Sync / Collect External Jobs
            </button>
          </div>

          <div style={{ margin: '20px 0' }}>
            <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0])} />
            <button onClick={handleUpload} style={{ marginLeft: '10px', padding: '6px 12px' }}>Upload Resume</button>
          </div>

          {message && <p style={{ fontWeight: 'bold', color: '#007bff', fontSize: '16px' }}>{message}</p>}

          {extractedText && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                border: '1px solid #ccc',
                borderRadius: '5px',
                display: 'inline-block',
                textAlign: 'left',
                maxWidth: '500px',
                whiteSpace: 'pre-wrap'
              }}>
                <h4>Extracted Text:</h4>
                <p>{extractedText}</p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={handleExtractSkills}
                  style={{ padding: '10px 15px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Extract Skills
                </button>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4>Extracted Resume Skills:</h4>
                {(skills.length > 0 ? skills : ["React", "Web Developer"]).map((skill, index) => (
                  <span key={index} style={{
                    display: 'inline-block',
                    backgroundColor: '#17a2b8',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '15px',
                    margin: '5px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {skill}
                  </span>
                ))}

                <div style={{ marginTop: '25px' }}>
                  <button 
                    onClick={handleMatchJobs}
                    style={{ padding: '12px 24px', backgroundColor: '#20c997', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                  >
                    Find Matching Jobs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cleaned Job List Output Container */}
          {jobs.length > 0 && (
            <div style={{ marginTop: '40px', textAlign: 'left', display: 'inline-block', width: '90%', maxWidth: '700px' }}>
              <h3 style={{ textAlign: 'center', color: '#333' }}>Matched Jobs ({jobs.length}):</h3>
              {jobs.map((job) => (
                <div key={job._id || Math.random()} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '18px', marginBottom: '18px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: '0', color: '#007bff' }}>{job.title}</h4>
                    <span style={{ backgroundColor: job.matchScore >= 70 ? '#28a745' : job.matchScore >= 40 ? '#ffc107' : '#dc3545', color: job.matchScore >= 40 && job.matchScore < 70 ? '#000' : '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                      {job.matchScore || 0}% Match
                    </span>
                  </div>
                  <p style={{ margin: '8px 0', color: '#666', fontSize: '14px' }}><strong>Company:</strong> {job.company} | <strong>Location:</strong> {job.location}</p>
                  
                  {/* Clean HTML entities from description */}
                  <p style={{ margin: '8px 0', fontSize: '13px', color: '#444' }}>
                    {job.description ? job.description.replace(/&lt;[^&]*&gt;|<[^>]*>/g, '').slice(0, 160) + '...' : ''}
                  </p>

                  {/* Render Matched Skills */}
                  <p style={{ margin: '6px 0', fontSize: '13px', color: '#28a745' }}>
                    <strong>Matched Skills:</strong> {job.matchedSkills && job.matchedSkills.length > 0 ? job.matchedSkills.join(', ') : 'None'}
                  </p>

                  {/* Render Missing Skills */}
                  <p style={{ margin: '6px 0', fontSize: '13px', color: job.missingSkills && job.missingSkills.length > 0 ? '#dc3545' : '#28a745' }}>
                    <strong>Missing Skills:</strong> {job.missingSkills && job.missingSkills.length > 0 ? job.missingSkills.join(', ') : 'None'}
                  </p>

                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    {job.applyLink && (
                      <a 
                        href={job.applyLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={() => handleJobAction(job._id, 'applied')}
                        style={{ padding: '6px 12px', backgroundColor: '#007bff', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
                      >
                        Apply Now ↗
                      </a>
                    )}
                    <button 
                      onClick={() => handleJobAction(job._id, 'saved')}
                      style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      ⭐ Save Job
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;