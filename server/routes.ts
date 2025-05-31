import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertAssessmentSchema, insertAssessmentScoreSchema } from "@shared/schema";

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
      res.status(500).json({ message: "Failed to fetch users" });
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

  const httpServer = createServer(app);
  return httpServer;
}
