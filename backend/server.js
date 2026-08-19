const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// Dynamic Environment Variables for Production
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mamatap2612_db_user:mamata321@cluster0.wemnnsc.mongodb.net/job-aggregator';

// Connect to MongoDB
mongoose.connect(MONGO_URI, { family: 4 })
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Schemas & Models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, default: "Remote" },
  requiredSkills: [String],
  description: { type: String, default: "No description provided." },
  applyLink: { type: String, default: "#" }
});
const Job = mongoose.model('Job', jobSchema);

const userJobSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  jobId: { type: String, required: true },
  status: { type: String, enum: ['saved', 'applied'], required: true }
});
const UserJob = mongoose.model('UserJob', userJobSchema);

// Register Route
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    const newUser = new User({ name, email, password });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful!", user });
  }catch(err){
    res.status(500).json({ error: "Login failed" });
  }
});

// File Upload Config
const upload = multer({ dest: 'uploads/' });

// Upload Resume Route
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a file" });
    }

    let text = "";
    if (req.file.mimetype === 'text/plain' || req.file.originalname.endsWith('.txt')) {
      text = fs.readFileSync(req.file.path, 'utf8');
    } else {
      const dataBuffer = fs.readFileSync(req.file.path);
const parser = new PDFParse({ data: dataBuffer });
const parsedData = await parser.getText();
text = parsedData.text;
    }

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text extracted" });
    }

    res.status(200).json({
      message: "Resume uploaded successfully!",
      extractedText: text.trim()
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to extract text from resume" });
  }
});

// Skill Extraction Route
app.post('/extract-skills', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const knownSkills = [
      'JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 
      'Python', 'HTML', 'CSS', 'SQL', 'Git', 'Java', 'C++', 'Web Developer'
    ];

    const extractedSkills = knownSkills.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );

    res.status(200).json({
      message: "Skills extracted successfully!",
      skills: extractedSkills
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to extract skills" });
  }
});

// Collect External Jobs Route
app.post('/collect-jobs', async (req, res) => {
  try {
    const response = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const apiData = await response.json();
    
    const knownSkills = ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'Python', 'HTML', 'CSS', 'SQL', 'Git', 'Java', 'C++'];

    const fetchedJobs = apiData.data.slice(0, 10).map(job => {
      const fullText = (job.title + " " + job.description).toLowerCase();
      const skillsInDesc = knownSkills.filter(skill => fullText.includes(skill.toLowerCase()));

      return {
        title: job.title,
        company: job.company_name,
        location: job.location || "Remote",
        requiredSkills: skillsInDesc.length > 0 ? skillsInDesc : ["JavaScript", "Web Developer"],
        description: job.description.replace(/<[^>]*>?/gm, '').substring(0, 180) + '...',
        applyLink: job.url
      };
    });

    for (let jobData of fetchedJobs) {
      await Job.updateOne(
        { title: jobData.title, company: jobData.company },
        { $setOnInsert: jobData },
        { upsert: true }
      );
    }

    const totalJobs = await Job.countDocuments();
    res.status(200).json({ 
      message: `Successfully collected ${fetchedJobs.length} live jobs!`, 
      totalJobs 
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to collect jobs" });
  }
});

// AI Job Matcher Route
app.post('/match-jobs', async (req, res) => {
  try {
    const { userSkills } = req.body;
    if (!userSkills || userSkills.length === 0) {
      return res.status(400).json({ error: "No skills provided" });
    }

    const jobs = await Job.find();

    const matchedJobs = jobs.map(job => {
      const required = job.requiredSkills || [];

      const matchingSkills = required.filter(skill => 
        userSkills.some(uSkill => uSkill.toLowerCase() === skill.toLowerCase())
      );

      const missingSkills = required.filter(skill => 
        !userSkills.some(uSkill => uSkill.toLowerCase() === skill.toLowerCase())
      );

      const score = required.length > 0 
        ? Math.round((matchingSkills.length / required.length) * 100) 
        : 0;

      return {
        ...job.toObject(),
        matchScore: score,
        matchedSkills: matchingSkills,
        missingSkills: missingSkills
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({ jobs: matchedJobs });
  } catch (err) {
    res.status(500).json({ error: "Failed to match jobs" });
  }
});

// User Job Action (Save/Apply) Endpoint
app.post('/user-job-action', async (req, res) => {
  try {
    const { userEmail, jobId, status } = req.body;
    if (!userEmail || !jobId || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await UserJob.findOneAndUpdate(
      { userEmail, jobId },
      { status },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: `Job successfully marked as ${status}!` });
  } catch (err) {
    res.status(500).json({ error: "Failed to save job action" });
  }
});

// Dashboard Stats Endpoint
app.post('/dashboard-stats', async (req, res) => {
  try {
    const { userEmail, userSkills } = req.body;

    const totalJobs = await Job.countDocuments();
    const userActions = userEmail ? await UserJob.find({ userEmail }) : [];

    const savedJobsCount = userActions.filter(a => a.status === 'saved').length;
    const appliedJobsCount = userActions.filter(a => a.status === 'applied').length;

    const jobs = await Job.find();
    let totalScore = 0;
    let recommendedCount = 0;

    if (userSkills && userSkills.length > 0) {
      jobs.forEach(job => {
        const required = job.requiredSkills || [];
        const matching = required.filter(s => 
          userSkills.some(u => u.toLowerCase() === s.toLowerCase())
        );
        const score = required.length > 0 ? Math.round((matching.length / required.length) * 100) : 0;
        
        totalScore += score;
        if (score >= 50) recommendedCount++;
      });
    }

    const avgMatchScore = jobs.length > 0 && userSkills?.length > 0 
      ? Math.round(totalScore / jobs.length) 
      : 0;

    res.status(200).json({
      totalJobs,
      recommendedJobs: recommendedCount,
      savedJobs: savedJobsCount,
      appliedJobs: appliedJobsCount,
      avgMatchScore
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});