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
      assessmentScores,
      stepScores
    );

    // Calculate overall proficiency
    const overallProficiency = StepLevelCalculator.getOverallProficiencyLevel(unifiedStepLevels);

    // Header with proper spacing
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SalesCoach Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Coach and Coachee info line with better formatting
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoLine = `Coach: ${coach.fullName} |     Coachee: ${assessment.assesseeName} |            Proficiency Level: ${overallProficiency.text}               ${new Date().toLocaleDateString('de-DE')} | ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(infoLine, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 25;

    // Add horizontal line separator
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 15;

    // Context section with proper formatting
    if (assessment.context) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Context:', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contextLines = doc.splitTextToSize(assessment.context, pageWidth - 40);
      doc.text(contextLines, 25, yPosition);
      yPosition += contextLines.length * 5 + 20;
      
      // Add spacing line after context
      doc.setLineWidth(0.2);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 15;
    }

    // Steps with behaviors - Professional formatting
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const unifiedLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Step header with colored level indicator
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const stepTitle = `${stepIndex + 1}. ${step.title}`;
      const levelText = unifiedLevel ? StepLevelCalculator.getLevelText(unifiedLevel.level) : '';
      
      doc.setTextColor(0, 0, 0); // Black for step title
      doc.text(stepTitle, 20, yPosition);
      
      if (levelText && unifiedLevel) {
        // Color-code the proficiency level
        const levelColors = {
          1: [239, 68, 68],   // Red for Learner
          2: [245, 158, 11],  // Orange for Qualified
          3: [59, 130, 246],  // Blue for Experienced
          4: [34, 197, 94]    // Green for Master
        };
        const color = levelColors[unifiedLevel.level as keyof typeof levelColors] || [107, 114, 128];
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(levelText, pageWidth - 20 - doc.getTextWidth(levelText), yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
      }
      yPosition += 20;

      // Substeps and behaviors with proper indentation
      step.substeps.forEach(substep => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Substep title with proper indentation
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(substep.title, 30, yPosition);
        yPosition += 12;

        // Behaviors with level-based formatting and color indicators
        substep.behaviors.forEach(behavior => {
          // Check if we need a new page
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(9);
          const isChecked = checkedBehaviorIds.has(behavior.id);
          
          // Format with level prefix (L1:, L2:, etc.) and behavior description
          const levelPrefix = `L${behavior.proficiencyLevel || 1}: `;
          const behaviorDescription = behavior.description;
          
          // Color-code level prefix based on proficiency level
          const levelColors = {
            1: [239, 68, 68],   // Red for L1
            2: [245, 158, 11],  // Orange for L2
            3: [59, 130, 246],  // Blue for L3
            4: [34, 197, 94]    // Green for L4
          };
          const levelColor = levelColors[behavior.proficiencyLevel as keyof typeof levelColors] || [107, 114, 128];
          
          // Draw colored circle indicator for checked behaviors
          if (isChecked) {
            doc.setFillColor(34, 197, 94); // Green for checked
            doc.circle(40, yPosition - 1, 1.5, 'F');
          }
          
          // Draw level prefix with color
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(levelColor[0], levelColor[1], levelColor[2]);
          doc.text(levelPrefix, 45, yPosition);
          
          // Draw behavior description with proper wrapping
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(isChecked ? 0 : 100, isChecked ? 0 : 100, isChecked ? 0 : 100); // Darker for checked behaviors
          const prefixWidth = doc.getTextWidth(levelPrefix);
          const maxWidth = pageWidth - 100;
          const lines = doc.splitTextToSize(behaviorDescription, maxWidth);
          
          // First line starts after the level prefix
          doc.text(lines[0], 45 + prefixWidth, yPosition);
          
          // Additional lines are properly indented
          for (let i = 1; i < lines.length; i++) {
            yPosition += 4;
            doc.text(lines[i], 45 + prefixWidth, yPosition);
          }
          
          // Reset text color
          doc.setTextColor(0, 0, 0);
          yPosition += 5; // Space between behaviors
        });
        yPosition += 8; // Space between substeps
      });
      yPosition += 15; // Space between steps
    }

    // Coaching notes sections with color-coded backgrounds
    const sections = [
      { title: 'Key Observations', content: assessment.keyObservations, color: [249, 250, 251] }, // Light gray
      { title: 'What Worked Well', content: assessment.whatWorkedWell, color: [240, 253, 244] }, // Light green
      { title: 'What Can Be Improved', content: assessment.whatCanBeImproved, color: [254, 242, 242] }, // Light red
      { title: 'Next Steps', content: assessment.nextSteps, color: [239, 246, 255] } // Light blue
    ];

    sections.forEach(section => {
      if (section.content) {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = 20;
        }

        // Add extra spacing before coaching sections
        yPosition += 15;

        // Calculate content height for background rectangle
        const lines = doc.splitTextToSize(section.content, pageWidth - 50);
        const contentHeight = lines.length * 5 + 25;

        // Draw colored background rectangle
        doc.setFillColor(section.color[0], section.color[1], section.color[2]);
        doc.rect(20, yPosition - 5, pageWidth - 40, contentHeight, 'F');

        // Draw border around the section
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(20, yPosition - 5, pageWidth - 40, contentHeight);

        // Section title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55); // Dark gray
        doc.text(`${section.title}:`, 25, yPosition + 8);
        yPosition += 15;

        // Section content
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99); // Medium gray
        doc.text(lines, 25, yPosition);
        yPosition += lines.length * 5 + 15;

        // Reset text color to black
        doc.setTextColor(0, 0, 0);
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