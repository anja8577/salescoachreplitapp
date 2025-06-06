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

    // Blue header box with reduced height (30% smaller)
    doc.setFillColor(59, 130, 246); // Blue color
    doc.rect(0, 0, pageWidth, 28, 'F'); // Reduced from 40 to 28
    
    // SalesCoach Report title in white on blue background, left aligned
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // White text
    doc.text('SalesCoach Report', 20, 15);
    
    // Coach and Coachee info right below title with minimal spacing
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255); // White text
    
    // Left aligned info with vertical separators - positioned very close to title
    const coachText = `Coach: ${coach.fullName}`;
    const coacheeText = `Coachee: ${assessment.assesseeName}`;
    const proficiencyText = `Proficiency Level: ${overallProficiency.text}`;
    const leftInfo = `${coachText} | ${coacheeText} | ${proficiencyText}`;
    doc.text(leftInfo, 20, 25); // Much closer to title
    
    // Right aligned date/time with vertical separator
    const createdDate = assessment.createdAt ? new Date(assessment.createdAt) : new Date();
    const dateText = createdDate.toLocaleDateString('de-DE');
    const timeText = createdDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const rightInfo = `${dateText} | ${timeText}`;
    doc.text(rightInfo, pageWidth - 20 - doc.getTextWidth(rightInfo), 25);
    
    yPosition = 40; // Reduced from 55

    // Two-column layout: Context box (left) and Spider graph (right)
    const columnWidth = (pageWidth - 60) / 2; // Split into two columns with spacing
    const leftColumnX = 20;
    const rightColumnX = leftColumnX + columnWidth + 20;
    
    // Context section (left column)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Reset to black
    doc.text('Context:', leftColumnX, yPosition);
    
    let contextHeight = 40; // Default height
    if (assessment.context) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contextLines = doc.splitTextToSize(assessment.context, columnWidth - 20);
      contextHeight = Math.max(40, contextLines.length * 5 + 20);
      
      // Draw light grey outlined box for context
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(leftColumnX, yPosition + 5, columnWidth, contextHeight);
      
      // Add context text inside box
      doc.text(contextLines, leftColumnX + 5, yPosition + 15);
    } else {
      // Empty context box
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(leftColumnX, yPosition + 5, columnWidth, contextHeight);
    }
    
    // Spider graph (right column) - much larger and more visible
    const graphRadius = Math.min(columnWidth * 0.8, contextHeight * 0.8) / 2; // Much larger radius
    const centerX = rightColumnX + columnWidth / 2;
    const centerY = yPosition + 5 + contextHeight / 2;
    
    // Draw spider graph background circles for proficiency levels
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    
    // Draw concentric circles for levels (1-4)
    for (let level = 1; level <= 4; level++) {
      const levelRadius = (graphRadius * level) / 4;
      doc.circle(centerX, centerY, levelRadius, 'S');
    }
    
    // Draw axes for each step with labels
    const stepCount = Math.min(steps.length, 7);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    
    for (let i = 0; i < stepCount; i++) {
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const endX = centerX + Math.cos(angle) * graphRadius;
      const endY = centerY + Math.sin(angle) * graphRadius;
      doc.line(centerX, centerY, endX, endY);
      
      // Add step number labels at the end of each axis
      const labelX = centerX + Math.cos(angle) * (graphRadius + 8);
      const labelY = centerY + Math.sin(angle) * (graphRadius + 8);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(`${i + 1}`, labelX - 2, labelY + 2);
    }
    
    // Plot actual proficiency levels as filled polygon
    const plotPoints = [];
    for (let i = 0; i < stepCount; i++) {
      const step = steps[i];
      const stepLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      const level = stepLevel ? stepLevel.level : 1;
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const plotRadius = (graphRadius * level) / 4;
      const x = centerX + Math.cos(angle) * plotRadius;
      const y = centerY + Math.sin(angle) * plotRadius;
      plotPoints.push([x, y]);
    }
    
    // Draw the proficiency polygon with fill and stroke
    if (plotPoints.length > 0) {
      doc.setFillColor(59, 130, 246, 0.3); // Semi-transparent blue fill
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(2);
      
      // Create the polygon path
      let pathString = `M ${plotPoints[0][0]} ${plotPoints[0][1]}`;
      for (let i = 1; i < plotPoints.length; i++) {
        pathString += ` L ${plotPoints[i][0]} ${plotPoints[i][1]}`;
      }
      pathString += ' Z'; // Close the path
      
      // Draw filled polygon manually using multiple line segments
      doc.setFillColor(59, 130, 246, 0.2);
      for (let i = 0; i < plotPoints.length; i++) {
        const nextIndex = (i + 1) % plotPoints.length;
        doc.line(plotPoints[i][0], plotPoints[i][1], plotPoints[nextIndex][0], plotPoints[nextIndex][1]);
      }
      
      // Add dots at each proficiency point
      doc.setFillColor(59, 130, 246);
      for (const point of plotPoints) {
        doc.circle(point[0], point[1], 1.5, 'F');
      }
    }
    
    // Reset colors
    doc.setTextColor(0, 0, 0);
    
    yPosition += contextHeight + 15;

    // Steps with behaviors - Professional formatting
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const unifiedLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Colored step box with step number and title (reduced height)
      const stepColors = [
        [236, 72, 153],   // Pink
        [59, 130, 246],   // Blue
        [34, 197, 94],    // Green
        [251, 191, 36],   // Bold yellow
        [239, 68, 68],    // Red
        [91, 33, 182],    // Dark purple
        [168, 85, 247]    // Light purple
      ];
      const stepColor = stepColors[stepIndex % stepColors.length];
      
      // Draw colored step header box (reduced height by 10% more)
      doc.setFillColor(stepColor[0], stepColor[1], stepColor[2]);
      doc.rect(20, yPosition - 2, pageWidth - 40, 12, 'F'); // Reduced from 13 to 12 (10% reduction)
      
      // Step number and title in white text
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      const stepTitle = `${stepIndex + 1}. ${step.title}`;
      doc.text(stepTitle, 25, yPosition + 6); // Adjusted centering
      
      // Level text on the right side of the colored box
      const levelText = unifiedLevel ? StepLevelCalculator.getLevelText(unifiedLevel.level) : '';
      if (levelText) {
        doc.text(levelText, pageWidth - 25 - doc.getTextWidth(levelText), yPosition + 6);
      }
      
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += 18; // Reduced from 20

      // Substeps and behaviors with proper indentation
      step.substeps.forEach(substep => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Substep title aligned with step number (position 25)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(substep.title, 25, yPosition);
        yPosition += 8; // Reduced from 12

        // Behaviors with checkboxes aligned with first letter of step title
        substep.behaviors.forEach(behavior => {
          // Check if we need a new page
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(9);
          const isChecked = checkedBehaviorIds.has(behavior.id);
          
          // Draw checkbox aligned with first letter of step title (around position 28)
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.5);
          doc.rect(28, yPosition - 3, 3, 3); // Aligned with step title first letter
          
          // Fill checkbox if behavior is checked (grey fill)
          if (isChecked) {
            doc.setFillColor(128, 128, 128); // Grey fill for checked
            doc.rect(28, yPosition - 3, 3, 3, 'F');
          }
          
          // Format behavior text with level prefix
          const levelPrefix = `L${behavior.proficiencyLevel || 1}: `;
          const behaviorDescription = behavior.description;
          
          // Draw level prefix aligned with checkbox
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(levelPrefix, 35, yPosition); // Start text after checkbox
          
          // Draw behavior description with proper wrapping
          const prefixWidth = doc.getTextWidth(levelPrefix);
          const maxWidth = pageWidth - 75; // Adjusted for new positioning
          const lines = doc.splitTextToSize(behaviorDescription, maxWidth);
          
          // First line starts after the level prefix
          doc.text(lines[0], 35 + prefixWidth, yPosition);
          
          // Additional lines are properly indented
          for (let i = 1; i < lines.length; i++) {
            yPosition += 4;
            doc.text(lines[i], 35 + prefixWidth, yPosition);
          }
          
          yPosition += 4; // Reduced space between behaviors from 5 to 4
        });
        yPosition += 6; // Reduced space between substeps from 8 to 6
      });
      yPosition += 10; // Reduced space between steps from 15 to 10
    }

    // Coaching notes sections with light colored backgrounds and grey outlines
    const sections = [
      { title: 'Key Observations', content: assessment.keyObservations, color: [249, 250, 251] }, // Light gray
      { title: 'What Worked Well', content: assessment.whatWorkedWell, color: [240, 253, 244] }, // Light green
      { title: 'What Can Be Improved', content: assessment.whatCanBeImproved, color: [254, 242, 242] }, // Light red
      { title: 'Next Steps', content: assessment.nextSteps, color: [239, 246, 255] } // Light blue
    ];

    sections.forEach((section, index) => {
      // Add minimal spacing between sections (reduced further to 5)
      if (index > 0) yPosition += 5;

      // Calculate content height for proper box sizing
      let contentHeight = 30; // Minimum height for title
      const lines = section.content ? doc.splitTextToSize(section.content, pageWidth - 50) : [];
      if (lines.length > 0) {
        contentHeight = lines.length * 5 + 30; // 30 for title + padding
      }

      // Check if section would span two pages - if so, move to next page
      if (yPosition + contentHeight > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      // Draw light colored background rectangle
      doc.setFillColor(section.color[0], section.color[1], section.color[2]);
      doc.rect(20, yPosition, pageWidth - 40, contentHeight, 'F');

      // Draw light grey border around the section
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(20, yPosition, pageWidth - 40, contentHeight);

      // Section title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Black title
      doc.text(`${section.title}:`, 25, yPosition + 12);

      // Section content if available
      if (section.content && lines.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0); // Black text
        doc.text(lines, 25, yPosition + 22);
      }

      yPosition += contentHeight;
    });

    // Electronic Signatures section
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = 20;
    }

    yPosition += 15; // Reduced spacing

    // Electronic Signatures header with reduced grey background (40% smaller)
    doc.setFillColor(245, 245, 245); // Light grey background
    doc.rect(20, yPosition - 2, pageWidth - 40, 12, 'F'); // Reduced from 20 to 12 height
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Electronic Signatures', 20, yPosition + 6); // Adjusted vertical centering
    yPosition += 20; // Reduced from 30

    // Coach signature line
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Coach Signature:', 20, yPosition);
    doc.text('Date:', pageWidth - 80, yPosition);
    yPosition += 15;
    
    // Signature line for coach
    doc.line(20, yPosition, 120, yPosition);
    doc.line(pageWidth - 80, yPosition, pageWidth - 20, yPosition);
    
    // Coach name below signature line
    doc.text(coach.fullName, 50, yPosition + 10);
    yPosition += 35;

    // Coachee signature line
    doc.text('Coachee Signature:', 20, yPosition);
    doc.text('Date:', pageWidth - 80, yPosition);
    yPosition += 15;
    
    // Signature line for coachee
    doc.line(20, yPosition, 120, yPosition);
    doc.line(pageWidth - 80, yPosition, pageWidth - 20, yPosition);
    
    // Coachee name below signature line
    doc.text(assessment.assesseeName || '', 50, yPosition + 10);
    yPosition += 25;

    // Electronic signature note in medium grey and smaller font
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128); // Medium grey
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