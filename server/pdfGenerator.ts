import { jsPDF } from 'jspdf';
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
    
    // Create comprehensive PDF with all behavioral details
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Sales Coaching Assessment Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Assessment info box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.rect(20, yPosition, pageWidth - 40, 25);
    yPosition += 8;
    doc.text(`Coach: ${coach.fullName}`, 25, yPosition);
    yPosition += 6;
    doc.text(`Coachee: ${assessment.assesseeName}`, 25, yPosition);
    yPosition += 6;
    doc.text(`Date: ${new Date(assessment.createdAt!).toLocaleDateString()}`, 25, yPosition);
    yPosition += 6;
    doc.text(`Assessment: ${assessment.title}`, 25, yPosition);
    yPosition += 15;

    // Context section
    if (assessment.context) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Assessment Context', 20, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contextLines = doc.splitTextToSize(assessment.context, pageWidth - 40);
      doc.text(contextLines, 20, yPosition);
      yPosition += contextLines.length * 5 + 10;
    }

    // Performance Overview
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance Overview', 20, yPosition);
    yPosition += 10;

    // Create checked behaviors set
    const checkedBehaviorIds = new Set(assessmentScores.filter(score => score.checked).map(score => score.behaviorId));
    
    // Create step scores map
    const stepScoresMap: { [key: number]: number } = {};
    stepScores.forEach(score => {
      stepScoresMap[score.stepId] = score.level;
    });

    // Process each step
    steps.forEach((step, stepIndex) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      const checkedCount = step.substeps.reduce((total, substep) => {
        return total + substep.behaviors.reduce((subtotal, behavior) => {
          return subtotal + (checkedBehaviorIds.has(behavior.id) ? 1 : 0);
        }, 0);
      }, 0);

      const totalCount = step.substeps.reduce((total, substep) => {
        return total + substep.behaviors.length;
      }, 0);

      const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
      const manualLevel = stepScoresMap[step.id];

      // Step header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${stepIndex + 1}. ${step.title}`, 20, yPosition);
      yPosition += 8;

      // Progress info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Behaviors: ${checkedCount}/${totalCount} (${percentage}%)`, 25, yPosition);
      yPosition += 5;

      if (manualLevel) {
        doc.text(`Manual Score: Level ${manualLevel} - ${LEVEL_NAMES[manualLevel as keyof typeof LEVEL_NAMES]}`, 25, yPosition);
        yPosition += 5;
      }

      // Progress bar representation
      doc.rect(25, yPosition, 100, 3);
      const progressWidth = percentage;
      doc.setFillColor(percentage >= 80 ? 34 : percentage >= 60 ? 245 : 239, 
                       percentage >= 80 ? 197 : percentage >= 60 ? 158 : 68, 
                       percentage >= 80 ? 129 : percentage >= 60 ? 11 : 68);
      doc.rect(25, yPosition, progressWidth, 3, 'F');
      yPosition += 10;

      // Demonstrated behaviors
      if (checkedCount > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Demonstrated Behaviors:', 25, yPosition);
        yPosition += 6;

        step.substeps.forEach(substep => {
          const checkedBehaviors = substep.behaviors.filter(behavior => checkedBehaviorIds.has(behavior.id));
          if (checkedBehaviors.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text(`${substep.title}:`, 30, yPosition);
            yPosition += 5;

            checkedBehaviors.forEach(behavior => {
              doc.setFont('helvetica', 'normal');
              const behaviorLines = doc.splitTextToSize(`• ${behavior.description}`, pageWidth - 70);
              doc.text(behaviorLines, 35, yPosition);
              yPosition += behaviorLines.length * 4;
              
              if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 20;
              }
            });
            yPosition += 3;
          }
        });
      }
      yPosition += 5;
    });

    // Coaching notes sections
    const sections = [
      { title: 'Key Observations', content: assessment.keyObservations },
      { title: 'What Worked Well', content: assessment.whatWorkedWell },
      { title: 'What Can Be Improved', content: assessment.whatCanBeImproved },
      { title: 'Next Steps', content: assessment.nextSteps }
    ];

    sections.forEach(section => {
      if (section.content) {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(section.content, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 5 + 10;
      }
    });

    // Footer
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated by SalesCoach Assessment Platform - ${new Date().toLocaleDateString()}`, 
              pageWidth / 2, pageHeight - 15, { align: 'center' });
    
    // Save PDF to file
    const uploadsDir = this.ensureUploadsDirectory();
    const filename = `coaching-report-${assessment.id}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    
    // Write PDF to file
    fs.writeFileSync(filepath, Buffer.from(doc.output('arraybuffer')));
    
    return filename; // Return relative filename for database storage
  }

  static getFilePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }

  static fileExists(relativePath: string): boolean {
    return fs.existsSync(this.getFilePath(relativePath));
  }
}