import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertAssessmentSchema, insertAssessmentScoreSchema } from "@shared/schema";
import { AuthService } from "./auth";
import { PDFGenerator } from "./pdfGenerator";
import path from "path";
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
      console.log("Teams GET request received");
      const startTime = Date.now();
      
      const teams = await storage.getUniqueTeams();
      
      console.log(`Teams fetched in ${Date.now() - startTime}ms:`, teams);
      res.json(teams);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({ 
          message: "Email address is already registered in the system",
          field: "email"
        });
      }
      
      const user = await storage.createUser(validatedData);
      res.json(user);
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(400).json({ message: "Invalid user data", error: error.message });
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

  // Request queue for user updates to prevent connection pool exhaustion
  const userUpdateQueue = new Map<number, Promise<any>>();

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    const userId = parseInt(req.params.id);
    const userData = req.body;
    
    try {
      console.log(`\n=== USER UPDATE REQUEST ===`);
      console.log(`User ID: ${userId}`);
      console.log(`Request body:`, userData);
      const startTime = Date.now();
      
      // Check if there's already an update in progress for this user
      if (userUpdateQueue.has(userId)) {
        console.log(`⏳ Waiting for existing update to complete for user ${userId}`);
        await userUpdateQueue.get(userId);
      }

      // Track team assignment operations specifically
      if (userData.team !== undefined) {
        console.log(`🔄 TEAM ASSIGNMENT: User ${userId} -> Team "${userData.team}"`);
      }

      // Create and queue the update operation
      const updatePromise = storage.updateUser(userId, userData);
      userUpdateQueue.set(userId, updatePromise);

      console.log(`⏱️  Starting storage.updateUser call...`);
      const storageStartTime = Date.now();
      const updatedUser = await updatePromise;
      console.log(`⏱️  storage.updateUser completed in ${Date.now() - storageStartTime}ms`);
      
      // Remove from queue when complete
      userUpdateQueue.delete(userId);
      
      console.log(`✅ Total request completed in ${Date.now() - startTime}ms`);
      console.log(`=== END USER UPDATE ===\n`);
      res.json(updatedUser);
    } catch (error) {
      console.error("❌ Error updating user:", error);
      userUpdateQueue.delete(userId);
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
      console.log("Assessment creation request body:", req.body);
      
      if (!title || !userId) {
        return res.status(400).json({ message: "Title and userId are required" });
      }

      const validatedData = {
        title,
        userId,
        assesseeName: assesseeName || "Unknown",
        context: req.body.context || null,
        keyObservations: req.body.keyObservations || null,
        whatWorkedWell: req.body.whatWorkedWell || null,
        whatCanBeImproved: req.body.whatCanBeImproved || null,
        nextSteps: req.body.nextSteps || null
      };
      
      console.log("Validated data:", validatedData);

      const assessment = await storage.createAssessment(validatedData);
      
      res.json(assessment);
    } catch (error) {
      console.error("Error creating assessment:", error);
      res.status(500).json({ message: "Failed to create assessment" });
    }
  });

  // Update assessment with coaching session data
  app.put("/api/assessments/:id", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const { context, keyObservations, whatWorkedWell, whatCanBeImproved, nextSteps } = req.body;
      
      console.log("Updating assessment", assessmentId, "with coaching data:", {
        context,
        keyObservations,
        whatWorkedWell,
        whatCanBeImproved,
        nextSteps
      });

      const updatedAssessment = await storage.updateAssessment(assessmentId, {
        context,
        keyObservations,
        whatWorkedWell,
        whatCanBeImproved,
        nextSteps
      });

      res.json(updatedAssessment);
    } catch (error) {
      console.error("Error updating assessment:", error);
      res.status(500).json({ message: "Failed to update assessment" });
    }
  });

  // Generate and serve PDF on demand
  app.get("/api/assessments/:id/pdf", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      
      // Get all required data for PDF generation
      const [assessment, steps, assessmentScores, stepScores] = await Promise.all([
        storage.getAssessment(assessmentId),
        storage.getAllSteps(),
        storage.getAssessmentScores(assessmentId),
        storage.getStepScores(assessmentId)
      ]);

      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Check if assessment has been saved (has coaching notes)
      if (!assessment.keyObservations && !assessment.whatWorkedWell && 
          !assessment.whatCanBeImproved && !assessment.nextSteps) {
        return res.status(400).json({ 
          message: "Assessment must be saved before generating PDF report",
          requiresSave: true 
        });
      }

      // Get coachee data (the person being assessed)
      const coachee = await storage.getUserById(assessment.userId);
      if (!coachee) {
        return res.status(404).json({ message: "Coachee not found" });
      }

      // Get the authenticated coach from the request headers
      const authHeader = req.headers.authorization;
      let coach = null;
      
      console.log("PDF Generation - Auth header:", authHeader ? "Present" : "Missing");
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = AuthService.verifyToken(token);
          console.log("PDF Generation - Token decoded:", decoded ? "Success" : "Failed");
          if (decoded) {
            coach = await AuthService.getUserById(decoded.userId);
            console.log("PDF Generation - Coach found:", coach ? coach.fullName : "Not found");
          }
        } catch (error) {
          console.log('PDF Generation - Token verification failed:', error);
        }
      }
      
      // If no authenticated coach found, get default user (first user in system)
      if (!coach) {
        const users = await storage.getAllUsers();
        coach = users.length > 0 ? users[0] : coachee;
        console.log("PDF Generation - Using fallback coach:", coach.fullName);
      }

      console.log("Generating PDF for assessment", assessmentId);
      
      // Generate PDF
      const pdfFilename = await PDFGenerator.generateCoachingReport({
        assessment,
        coach,
        steps,
        assessmentScores,
        stepScores
      });

      const filePath = PDFGenerator.getFilePath(pdfFilename);
      
      // Send PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="coaching-report-${assessment.assesseeName || 'assessment'}-${assessmentId}.pdf"`);
      
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to send PDF' });
          }
        }
        // Clean up temporary file after sending
        setTimeout(() => {
          try {
            if (PDFGenerator.fileExists(pdfFilename)) {
              import('fs').then(fs => fs.unlinkSync(filePath));
            }
          } catch (cleanupError) {
            console.error('Error cleaning up PDF file:', cleanupError);
          }
        }, 1000);
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
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

  // Get latest assessment for a coachee by name
  app.get("/api/coachees/:coacheeName/latest-assessment", async (req, res) => {
    try {
      const coacheeName = decodeURIComponent(req.params.coacheeName);
      const latestAssessment = await storage.getLatestAssessmentForCoachee(coacheeName);
      
      if (!latestAssessment) {
        return res.status(404).json({ message: "No previous assessment found for this coachee" });
      }
      
      res.json(latestAssessment);
    } catch (error) {
      console.error("Error fetching latest assessment for coachee:", error);
      res.status(500).json({ message: "Failed to fetch latest assessment" });
    }
  });

  // Get previous assessment for a coachee (excluding specified assessment ID)
  app.get("/api/coachees/:coacheeName/previous-assessment/:excludeId", async (req, res) => {
    try {
      const coacheeName = decodeURIComponent(req.params.coacheeName);
      const excludeId = parseInt(req.params.excludeId);
      const previousAssessment = await storage.getPreviousAssessmentForCoachee(coacheeName, excludeId);
      
      if (!previousAssessment) {
        return res.status(404).json({ message: "No previous assessment found for this coachee" });
      }
      
      res.json(previousAssessment);
    } catch (error) {
      console.error("Error fetching previous assessment for coachee:", error);
      res.status(500).json({ message: "Failed to fetch previous assessment" });
    }
  });

  // Get assessment scores
  app.get("/api/assessments/:id/scores", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const scores = await storage.getAssessmentScores(assessmentId);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching assessment scores:", error);
      res.status(500).json({ message: "Failed to fetch assessment scores" });
    }
  });

  // Update assessment score (behavior checkbox)
  app.put("/api/assessments/:id/scores/:behaviorId", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const behaviorId = parseInt(req.params.behaviorId);
      const { checked } = req.body;
      
      const score = await storage.updateAssessmentScore(assessmentId, behaviorId, checked);
      res.json(score);
    } catch (error) {
      console.error("Error updating assessment score:", error);
      res.status(500).json({ message: "Failed to update assessment score" });
    }
  });

  // Get step scores
  app.get("/api/assessments/:id/step-scores", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const stepScores = await storage.getStepScores(assessmentId);
      res.json(stepScores);
    } catch (error) {
      console.error("Error fetching step scores:", error);
      res.status(500).json({ message: "Failed to fetch step scores" });
    }
  });

  // Update step score (manual step level)
  app.put("/api/assessments/:id/step-scores/:stepId", async (req, res) => {
    try {
      const assessmentId = parseInt(req.params.id);
      const stepId = parseInt(req.params.stepId);
      const { level } = req.body;
      
      console.log(`Updating step score for assessment ${assessmentId}, step ${stepId}, level: ${level}`);
      
      const stepScore = await storage.updateStepScore(assessmentId, stepId, level);
      res.json(stepScore);
    } catch (error) {
      console.error("Error updating step score:", error);
      res.status(500).json({ message: "Failed to update step score" });
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

      if (userData.password.length < 3) {
        return res.status(400).json({ error: "Password must be at least 3 characters" });
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

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Generate reset token
      const resetToken = await AuthService.generateResetToken(email);
      
      if (!resetToken) {
        // Don't reveal if email exists or not for security
        return res.json({ message: "If an account with that email exists, we've sent a reset link." });
      }

      // Get user details for email
      const user = await AuthService.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account with that email exists, we've sent a reset link." });
      }

      // Import and send email
      const { EmailService } = await import('./emailService');
      const emailSent = await EmailService.sendPasswordResetEmail(email, resetToken, user.fullName);

      if (!emailSent) {
        console.error("Failed to send password reset email to:", email);
        return res.status(500).json({ error: "Failed to send reset email" });
      }

      res.json({ message: "If an account with that email exists, we've sent a reset link." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 3) {
        return res.status(400).json({ error: "Password must be at least 3 characters" });
      }

      const success = await AuthService.resetPassword(token, password);
      
      if (!success) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
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

  // Team management endpoints
  app.post("/api/teams", async (req, res) => {
    try {
      console.log("Team creation request received:", req.body);
      const startTime = Date.now();
      
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Team name is required" });
      }
      
      // Check if team already exists
      const existingTeams = await storage.getUniqueTeams();
      if (existingTeams.includes(name)) {
        return res.status(400).json({ message: "Team already exists" });
      }
      
      // Just validate the team name - no placeholder users needed
      // Teams are created implicitly when users are assigned to them
      console.log(`Team "${name}" validated in ${Date.now() - startTime}ms`);
      res.json({ message: "Team created successfully", name });
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put("/api/teams/:name", async (req, res) => {
    try {
      console.log("=== TEAM RENAME REQUEST ===");
      const startTime = Date.now();
      
      const oldName = req.params.name;
      const { newName } = req.body;
      
      console.log(`Renaming team "${oldName}" to "${newName}"`);
      
      if (!newName) {
        return res.status(400).json({ message: "New team name is required" });
      }
      
      // Use bulk update for better performance
      console.log(`🚀 Starting bulk team update...`);
      const bulkStartTime = Date.now();
      
      const affectedUsers = await storage.bulkUpdateUsersTeam(oldName, newName);
      
      const bulkTime = Date.now() - bulkStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Bulk update completed: ${affectedUsers} users in ${bulkTime}ms`);
      console.log(`✅ Total team rename completed in ${totalTime}ms`);
      console.log("=== END TEAM RENAME ===");
      
      res.json({ 
        message: "Team renamed successfully", 
        oldName, 
        newName, 
        affectedUsers,
        duration: totalTime 
      });
    } catch (error: any) {
      console.error("❌ Team rename failed:", error);
      res.status(500).json({ message: "Failed to rename team" });
    }
  });

  app.delete("/api/teams/:name", async (req, res) => {
    try {
      console.log("=== TEAM DELETE REQUEST ===");
      const startTime = Date.now();
      const teamName = req.params.name;
      
      console.log(`Deleting team "${teamName}"`);
      
      // Use bulk update for better performance
      console.log(`🚀 Starting bulk team deletion...`);
      const bulkStartTime = Date.now();
      
      const affectedUsers = await storage.bulkUpdateUsersTeam(teamName, null);
      
      const bulkTime = Date.now() - bulkStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Bulk deletion completed: ${affectedUsers} users in ${bulkTime}ms`);
      console.log(`✅ Total team deletion completed in ${totalTime}ms`);
      console.log("=== END TEAM DELETE ===");
      
      res.json({ 
        message: "Team deleted successfully", 
        teamName, 
        affectedUsers,
        duration: totalTime 
      });
    } catch (error: any) {
      console.error("❌ Team deletion failed:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Update user with enhanced logging and performance tracking
  app.put("/api/users/:id", async (req, res) => {
    const startTime = Date.now();
    console.log("=== USER UPDATE REQUEST ===");
    
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      console.log(`User ID: ${userId}`);
      console.log(`Request body:`, userData);
      
      // Track team assignment operations specifically
      if (userData.team !== undefined) {
        console.log(`🔄 TEAM ASSIGNMENT: User ${userId} -> Team "${userData.team}"`);
      }
      
      console.log(`⏱️  Starting storage.updateUser call...`);
      const storageStartTime = Date.now();
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      const storageTime = Date.now() - storageStartTime;
      console.log(`⏱️  storage.updateUser completed in ${storageTime}ms`);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Total request completed in ${totalTime}ms`);
      
      if (totalTime > 100) {
        console.warn(`🐌 SLOW REQUEST WARNING: User ${userId} update took ${totalTime}ms`);
      }
      
      console.log("=== END USER UPDATE ===");
      res.json(updatedUser);
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ USER UPDATE FAILED in ${totalTime}ms:`, error);
      console.log("=== END USER UPDATE ===");
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}