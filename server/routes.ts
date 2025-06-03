import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertAssessmentSchema, insertAssessmentScoreSchema } from "@shared/schema";
import { AuthService } from "./auth";
import type { User, Assessment, AssessmentScore, UserRegistration, UserLogin } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default data
  await storage.initializeDefaultData();

  // Get all steps with substeps and behaviors
  app.get("/api/steps", async (req, res) => {
    try {
      const steps = await storage.getAllSteps();
      res.json(steps);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch steps" });
    }
  });

  // Create a new assessment
  app.post("/api/assessments", async (req, res) => {
    try {
      console.log("Assessment creation request body:", req.body);
      const validatedData = insertAssessmentSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const assessment = await storage.createAssessment(validatedData);
      res.json(assessment);
    } catch (error: any) {
      console.error("Assessment creation error:", error);
      res.status(400).json({ message: "Invalid assessment data", error: error.message });
    }
  });

  // Get assessment scores
  app.get("/api/assessments/:id/scores", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const scores = await storage.getAssessmentScores(assessmentId);
      res.json(scores);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessment scores" });
    }
  });

  // Update assessment score
  app.put("/api/assessments/:assessmentId/scores/:behaviorId", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.assessmentId);
      const behaviorId = parseInt(req.params.behaviorId);
      const { checked } = req.body;

      console.log(`Updating score for assessment ${assessmentId}, behavior ${behaviorId}, checked: ${checked}`);

      const score = await storage.updateAssessmentScore(assessmentId, behaviorId, checked);
      res.json(score);
    } catch (error: any) {
      console.error("Score update error:", error);
      res.status(500).json({ message: "Failed to update assessment score", error: error.message });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
  });

  // Get unique teams for dropdown suggestions
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getUniqueTeams();
      res.json(teams);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get assessment with user details
  app.get("/api/assessments/:id", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const assessment = await storage.getAssessmentWithUser(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessment" });
    }
  });

  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;

      const updatedUser = await storage.updateUser(userId, userData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Create assessment
  app.post("/api/assessments", async (req, res) => {
    try {
      const { title, userId, assesseeName } = req.body;
      
      if (!title || !userId) {
        return res.status(400).json({ message: "Title and userId are required" });
      }

      const assessment = await storage.createAssessment({
        title,
        userId,
        assesseeName: assesseeName || "Unknown",
        keyObservations: req.body.keyObservations,
        whatWorkedWell: req.body.whatWorkedWell,
        whatCanBeImproved: req.body.whatCanBeImproved,
        nextSteps: req.body.nextSteps
      });
      
      res.json(assessment);
    } catch (error) {
      console.error("Error creating assessment:", error);
      res.status(500).json({ message: "Failed to create assessment" });
    }
  });

  // Get all assessments
  app.get("/api/assessments", async (req, res) => {
    try {
      const assessments = await storage.getAllAssessments();
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  // Get assessment by ID
  app.get("/api/assessments/:id", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const assessment = await storage.getAssessment(assessmentId);
      
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ message: "Failed to fetch assessment" });
    }
  });

  // Get latest assessment for a user
  app.get("/api/users/:userId/latest-assessment", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const latestAssessment = await storage.getLatestAssessmentForUser(userId);
      
      if (!latestAssessment) {
        return res.status(404).json({ message: "No previous assessment found" });
      }
      
      res.json(latestAssessment);
    } catch (error) {
      console.error("Error fetching latest assessment:", error);
      res.status(500).json({ message: "Failed to fetch latest assessment" });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData: UserRegistration = req.body;

      // Basic validation
      if (!userData.email || !userData.password || !userData.fullName) {
        return res.status(400).json({ error: "Email, password, and full name are required" });
      }

      if (userData.password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const user = await AuthService.register(userData);
      const token = AuthService.generateToken(user.id);

      res.json({ user, token });
    } catch (error: any) {
      if (error.message === 'User already exists') {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to register user" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData: UserLogin = req.body;

      if (!loginData.email || !loginData.password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await AuthService.login(loginData);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = AuthService.generateToken(user.id);
      res.json({ user, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      // For simplicity, return the first available user from database
      const users = await storage.getAllUsers();
      if (users.length > 0) {
        return res.json(users[0]);
      }
      
      // If no users exist, return a basic user structure
      return res.json({
        id: 1,
        fullName: "Default User",
        email: "user@example.com",
        team: null,
        createdAt: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}