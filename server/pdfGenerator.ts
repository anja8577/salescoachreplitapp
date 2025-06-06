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

  private static addPageNumber(doc: any, pageNumber: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128); // Grey color
    doc.text(`${pageNumber}`, pageWidth - 20, pageHeight - 10);
  }

  static async generateCoachingReport(data: CoachingReportData): Promise<string> {
    const { assessment, coach, steps, assessmentScores, stepScores } = data;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    let currentPage = 1;

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
    
    // Add page number to first page
    this.addPageNumber(doc, currentPage);

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
    
    // Performance Overview Table (right column)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Performance Overview', rightColumnX, yPosition);
    
    // Create performance summary table
    const tableStartY = yPosition + 10;
    let tableY = tableStartY;
    
    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Sales Step', rightColumnX, tableY);
    doc.text('Level', rightColumnX + 60, tableY);
    doc.text('Proficiency', rightColumnX + 85, tableY);
    tableY += 5;
    
    // Header underline
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(rightColumnX, tableY, rightColumnX + columnWidth - 10, tableY);
    tableY += 8;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const stepLabels = ['Preparation', 'Opening', 'Need Dialog', 'Solution Dialog', 'Objection Resolution', 'Asking for Commitment', 'Follow up'];
    
    for (let i = 0; i < Math.min(steps.length, stepLabels.length); i++) {
      const step = steps[i];
      const stepLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      const level = stepLevel ? stepLevel.level : 1;
      const levelText = StepLevelCalculator.getLevelText(level);
      const levelCode = StepLevelCalculator.getLevelShortCode(level);
      
      // Step name
      doc.setTextColor(0, 0, 0);
      doc.text(stepLabels[i], rightColumnX, tableY);
      
      // Level badge with color
      let bgColor = [229, 231, 235]; // gray-200 default
      let textColor = [75, 85, 99]; // gray-600 default
      
      if (levelCode === 'EXP') {
        bgColor = [34, 197, 94]; // green-500
        textColor = [255, 255, 255]; // white
      } else if (levelCode === 'ADV') {
        bgColor = [59, 130, 246]; // blue-500
        textColor = [255, 255, 255]; // white
      } else if (levelCode === 'INT') {
        bgColor = [251, 191, 36]; // amber-400
        textColor = [0, 0, 0]; // black
      } else if (levelCode === 'BEG') {
        bgColor = [239, 68, 68]; // red-500
        textColor = [255, 255, 255]; // white
      }
      
      // Draw level badge background
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.roundedRect(rightColumnX + 58, tableY - 3, 16, 5, 1, 1, 'F');
      
      // Level code text
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const codeWidth = doc.getTextWidth(levelCode);
      doc.text(levelCode, rightColumnX + 66 - codeWidth/2, tableY);
      
      // Proficiency text
      doc.setTextColor(0, 0, 0);
      doc.text(levelText, rightColumnX + 85, tableY);
      
      tableY += 7;
    }
    
    // Overall proficiency summary
    const overallLevel = StepLevelCalculator.getOverallProficiencyLevel(unifiedStepLevels);
    tableY += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Overall Proficiency:', rightColumnX, tableY);
    
    // Overall level badge
    const overallCode = StepLevelCalculator.getLevelShortCode(overallLevel.level);
    const overallText = StepLevelCalculator.getLevelText(overallLevel.level);
    
    let overallBgColor = [229, 231, 235];
    let overallTextColor = [75, 85, 99];
    
    if (overallCode === 'EXP') {
      overallBgColor = [34, 197, 94];
      overallTextColor = [255, 255, 255];
    } else if (overallCode === 'ADV') {
      overallBgColor = [59, 130, 246];
      overallTextColor = [255, 255, 255];
    } else if (overallCode === 'INT') {
      overallBgColor = [251, 191, 36];
      overallTextColor = [0, 0, 0];
    } else if (overallCode === 'BEG') {
      overallBgColor = [239, 68, 68];
      overallTextColor = [255, 255, 255];
    }
    
    doc.setFillColor(overallBgColor[0], overallBgColor[1], overallBgColor[2]);
    doc.roundedRect(rightColumnX + 58, tableY - 3, 16, 5, 1, 1, 'F');
    
    doc.setTextColor(overallTextColor[0], overallTextColor[1], overallTextColor[2]);
    const overallCodeWidth = doc.getTextWidth(overallCode);
    doc.text(overallCode, rightColumnX + 66 - overallCodeWidth/2, tableY);
    
    doc.setTextColor(0, 0, 0);
    doc.text(overallText, rightColumnX + 85, tableY);
    
    yPosition += Math.max(contextHeight, tableY - tableStartY + 10) + 15;

    // Steps with behaviors - Professional formatting
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const unifiedLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      
      // Force new page before "Asking for Commitment" (step 6, index 5)
      if (stepIndex === 5) {
        doc.addPage();
        currentPage++;
        this.addPageNumber(doc, currentPage);
        yPosition = 20;
      }
      
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        currentPage++;
        this.addPageNumber(doc, currentPage);
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
        [196, 165, 255]   // Lighter purple for Step 7
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
          currentPage++;
          this.addPageNumber(doc, currentPage);
          yPosition = 20;
        }

        // Substep title aligned with step number (position 25)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(substep.title, 25, yPosition);
        yPosition += 5; // Further reduced to move behaviors closer

        // Behaviors with checkboxes aligned with first letter of step title
        substep.behaviors.forEach(behavior => {
          // Check if we need a new page
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            currentPage++;
            this.addPageNumber(doc, currentPage);
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
        currentPage++;
        this.addPageNumber(doc, currentPage);
        yPosition = 20;
      }

      // Section title above the box
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Black title
      doc.text(`${section.title}:`, 20, yPosition);
      yPosition += 4; // Reduced space between title and box

      // Recalculate content height without title space - increased by 15% more
      contentHeight = 28; // Minimum height for content only (increased by 15% more)
      if (lines.length > 0) {
        contentHeight = (lines.length * 5 + 15) * 1.4; // Content + padding, increased by 40% total
      }

      // Draw light colored background rectangle
      doc.setFillColor(section.color[0], section.color[1], section.color[2]);
      doc.rect(20, yPosition, pageWidth - 40, contentHeight, 'F');

      // Draw light grey border around the section
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(20, yPosition, pageWidth - 40, contentHeight);

      // Section content if available
      if (section.content && lines.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0); // Black text
        doc.text(lines, 25, yPosition + 12);
      }

      yPosition += contentHeight + 2; // Very small gap between boxes
    });

    // Electronic Signatures section
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      currentPage++;
      this.addPageNumber(doc, currentPage);
      yPosition = 20;
    }

    yPosition += 18; // Increased white space before electronic signatures (20% more)

    // Electronic Signatures section - condensed to 15% of page height max
    const maxSignatureHeight = pageHeight * 0.15; // 15% of page height
    const signatureStartY = yPosition;

    // Electronic Signatures header - very compact
    doc.setFillColor(245, 245, 245); // Light grey background
    doc.rect(20, yPosition - 1, pageWidth - 40, 8, 'F'); // Much smaller header
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Electronic Signatures', 22, yPosition + 4);
    yPosition += 12;

    // Compact signature lines in two columns
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Left column - Coach
    doc.text('Coach:', 20, yPosition);
    doc.line(20, yPosition + 8, 90, yPosition + 8);
    doc.text(coach.fullName, 20, yPosition + 14);
    
    // Right column - Coachee  
    doc.text('Coachee:', 100, yPosition);
    doc.line(100, yPosition + 8, 170, yPosition + 8);
    doc.text(assessment.assesseeName || '', 100, yPosition + 14);
    
    yPosition += 20;

    // Date fields in compact format
    doc.text('Date: _______________', 20, yPosition);
    doc.text('Date: _______________', 100, yPosition);
    yPosition += 8;

    // Compact electronic signature note
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text('Electronic signatures accepted for digital approval.', 20, yPosition);

    // Save PDF to file with standard naming format
    const uploadsDir = this.ensureUploadsDirectory();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    const coacheeName = assessment.assesseeName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
    const filename = `SalesCoach_Report_${coacheeName}_${dateStr}_${timeStr}.pdf`;
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