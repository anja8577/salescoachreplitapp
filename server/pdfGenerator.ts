import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { Assessment, User, Step, Substep, Behavior, AssessmentScore, StepScore } from '@shared/schema';
import { StepLevelCalculator } from '@shared/stepLevelCalculator';

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
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Create checked behaviors set
    const checkedBehaviorIds = new Set(assessmentScores.filter(score => score.checked).map(score => score.behaviorId));
    
    // Create step scores map
    const stepScoresMap: { [key: number]: number } = {};
    stepScores.forEach(score => {
      stepScoresMap[score.stepId] = score.level;
    });

    // Get unified step levels
    const unifiedStepLevels = StepLevelCalculator.getUnifiedStepLevels(
      steps,
      checkedBehaviorIds,
      stepScoresMap
    );

    // Calculate overall proficiency
    const overallProficiency = StepLevelCalculator.getOverallProficiencyLevel(unifiedStepLevels);

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SalesCoach Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Coach and Coachee info line
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const infoLine = `Coach: ${coach.fullName} |     Coachee: ${assessment.assesseeName} |            Proficiency Level: ${overallProficiency.text}               ${new Date().toLocaleDateString('de-DE')}`;
    doc.text(infoLine, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 25;

    // Context section
    if (assessment.context) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Context:', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contextLines = doc.splitTextToSize(assessment.context, pageWidth - 40);
      doc.text(contextLines, 20, yPosition);
      yPosition += contextLines.length * 5 + 15;
    }

    // Steps with behaviors
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const unifiedLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Step header with level
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const stepTitle = `${stepIndex + 1}. ${step.title}`;
      const levelText = unifiedLevel ? StepLevelCalculator.getLevelText(unifiedLevel.level) : '';
      
      doc.text(stepTitle, 20, yPosition);
      if (levelText) {
        const titleWidth = doc.getTextWidth(stepTitle);
        doc.text(levelText, pageWidth - 20 - doc.getTextWidth(levelText), yPosition);
      }
      yPosition += 15;

      // Substeps and behaviors
      step.substeps.forEach(substep => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Substep title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(substep.title, 25, yPosition);
        yPosition += 10;

        // Behaviors
        substep.behaviors.forEach(behavior => {
          // Check if we need a new page
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFont('helvetica', 'normal');
          const isChecked = checkedBehaviorIds.has(behavior.id);
          const prefix = isChecked ? '✓' : '';
          const behaviorText = `${prefix} ${behavior.description}`;
          
          // Split long behavior descriptions
          const lines = doc.splitTextToSize(behaviorText, pageWidth - 80);
          doc.text(lines, 35, yPosition);
          yPosition += lines.length * 4 + 2;
        });
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Coaching notes sections
    const sections = [
      { title: 'Key Observations', content: assessment.keyObservations },
      { title: 'What Worked Well', content: assessment.whatWorkedWell },
      { title: 'What Can Be Improved', content: assessment.whatCanBeImproved },
      { title: 'Next Steps', content: assessment.nextSteps }
    ];

    sections.forEach(section => {
      if (section.content) {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${section.title}:`, 20, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(section.content, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 5 + 15;
      }
    });

    // Electronic Signatures section
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Electronic Signatures', 20, yPosition);
    yPosition += 20;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Coach signature
    doc.text('Coach Signature:', 20, yPosition);
    doc.text('Date:', pageWidth - 60, yPosition);
    yPosition += 15;
    doc.text(coach.fullName, 60, yPosition);
    yPosition += 25;

    // Coachee signature
    doc.text('Coachee Signature:', 20, yPosition);
    doc.text('Date:', pageWidth - 60, yPosition);
    yPosition += 15;
    doc.text(assessment.assesseeName || '', 60, yPosition);
    yPosition += 25;

    // Note about electronic signatures
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Note: This document supports electronic signatures for digital approval.', 20, yPosition);

    // Save PDF to file
    const uploadsDir = this.ensureUploadsDirectory();
    const filename = `coaching-report-${assessment.id}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    
    // Write PDF to file
    fs.writeFileSync(filepath, Buffer.from(doc.output('arraybuffer')));
    
    return filename;
  }

  static getFilePath(relativePath: string): string {
    return path.join(process.cwd(), 'uploads', relativePath);
  }

  static fileExists(relativePath: string): boolean {
    return fs.existsSync(this.getFilePath(relativePath));
  }
}