import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';
import { Assessment, User, Step, Substep, Behavior, AssessmentScore, StepScore } from '@shared/schema';

type StepWithSubsteps = Step & {
  substeps: (Substep & {
    behaviors: Behavior[];
  })[];
};

interface CoachingReportData {
  assessment: Assessment;
  coach: User;
  steps: StepWithSubsteps[];
  assessmentScores: AssessmentScore[];
  stepScores: StepScore[];
}

const LEVEL_NAMES = {
  1: 'Learner',
  2: 'Qualified', 
  3: 'Experienced',
  4: 'Master'
};

export class PDFGenerator {
  private static ensureUploadsDirectory() {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    return uploadsDir;
  }

  static async generateCoachingReport(data: CoachingReportData): Promise<string> {
    const { assessment, coach, steps, assessmentScores, stepScores } = data;
    
    // Create PDF document
    const doc = new jsPDF();
    let yPosition = 20;
    
    // Header
    doc.setFontSize(20);
    doc.text('Sales Coaching Assessment Report', 20, yPosition);
    yPosition += 20;
    
    // Assessment Details
    doc.setFontSize(12);
    doc.text(`Coachee: ${assessment.assesseeName}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Coach: ${coach.fullName}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Date: ${new Date(assessment.createdAt || new Date()).toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Assessment: ${assessment.title}`, 20, yPosition);
    yPosition += 20;

    // Calculate overall performance
    const totalBehaviors = steps.reduce((sum, step) => 
      sum + step.substeps.reduce((subSum, substep) => subSum + substep.behaviors.length, 0), 0
    );
    const checkedBehaviors = assessmentScores.filter(score => score.checked).length;
    const overallScore = totalBehaviors > 0 ? Math.round((checkedBehaviors / totalBehaviors) * 100) : 0;

    doc.text(`Overall Performance: ${overallScore}% (${checkedBehaviors}/${totalBehaviors} behaviors demonstrated)`, 20, yPosition);
    yPosition += 20;

    // Step-by-Step Performance
    doc.setFontSize(14);
    doc.text('Step-by-Step Performance:', 20, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    for (const step of steps) {
      // Calculate step performance
      const stepBehaviors = step.substeps.reduce((sum, substep) => sum + substep.behaviors.length, 0);
      const stepChecked = assessmentScores.filter(score => 
        score.checked && step.substeps.some(substep => 
          substep.behaviors.some(behavior => behavior.id === score.behaviorId)
        )
      ).length;
      const stepPercentage = stepBehaviors > 0 ? Math.round((stepChecked / stepBehaviors) * 100) : 0;

      // Get manual step score
      const stepScore = stepScores.find(score => score.stepId === step.id);
      const levelText = stepScore ? LEVEL_NAMES[stepScore.level as keyof typeof LEVEL_NAMES] : 'Not Evaluated';

      doc.text(`${step.title}: ${stepPercentage}% behavioral | Manual Level: ${levelText}`, 20, yPosition);
      yPosition += 8;

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
    }

    yPosition += 10;

    // Coaching Observations
    if (assessment.keyObservations || assessment.whatWorkedWell || assessment.whatCanBeImproved || assessment.nextSteps) {
      doc.setFontSize(14);
      doc.text('Coaching Observations:', 20, yPosition);
      yPosition += 15;

      doc.setFontSize(10);
      
      if (assessment.keyObservations) {
        doc.text('Key Observations:', 20, yPosition);
        yPosition += 8;
        const observations = doc.splitTextToSize(assessment.keyObservations, 170);
        doc.text(observations, 20, yPosition);
        yPosition += observations.length * 5 + 10;
      }

      if (assessment.whatWorkedWell) {
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text('What Worked Well:', 20, yPosition);
        yPosition += 8;
        const worked = doc.splitTextToSize(assessment.whatWorkedWell, 170);
        doc.text(worked, 20, yPosition);
        yPosition += worked.length * 5 + 10;
      }

      if (assessment.whatCanBeImproved) {
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text('What Can Be Improved:', 20, yPosition);
        yPosition += 8;
        const improved = doc.splitTextToSize(assessment.whatCanBeImproved, 170);
        doc.text(improved, 20, yPosition);
        yPosition += improved.length * 5 + 10;
      }

      if (assessment.nextSteps) {
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text('Next Steps:', 20, yPosition);
        yPosition += 8;
        const steps = doc.splitTextToSize(assessment.nextSteps, 170);
        doc.text(steps, 20, yPosition);
        yPosition += steps.length * 5 + 10;
      }
    }

    // Generate filename and save
    const uploadsDir = this.ensureUploadsDirectory();
    const filename = `coaching-report-${assessment.id}-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    
    // Save PDF
    const pdfBuffer = doc.output('arraybuffer');
    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
    
    // Return relative path for storage in database
    return `uploads/${filename}`;
  }

  static getFilePath(relativePath: string): string {
    return path.join(process.cwd(), relativePath);
  }

  static fileExists(relativePath: string): boolean {
    const fullPath = this.getFilePath(relativePath);
    return fs.existsSync(fullPath);
  }
}