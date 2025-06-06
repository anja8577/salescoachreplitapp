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
    
    // Spider Graph - Use the exact same visualization as coaching session
    // Create a clean, professional spider graph that matches the UI
    const graphSize = Math.min(columnWidth * 0.4, contextHeight * 0.4);
    const centerX = rightColumnX + columnWidth / 2;
    const centerY = yPosition + 5 + contextHeight / 2;
    const maxRadius = graphSize / 2;
    
    const stepCount = 7;
    const stepLabels = ['Preparation', 'Opening', 'Need Dialog', 'Solution Dialog', 'Objection Resolution', 'Asking for Commitment', 'Follow up'];
    
    // Draw the grid structure (concentric heptagons)
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.5);
    
    for (let level = 1; level <= 4; level++) {
      const radius = (maxRadius * level) / 4;
      const points = [];
      
      for (let i = 0; i < stepCount; i++) {
        const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
        points.push([
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius
        ]);
      }
      
      // Draw the heptagon
      for (let i = 0; i < points.length; i++) {
        const next = (i + 1) % points.length;
        doc.line(points[i][0], points[i][1], points[next][0], points[next][1]);
      }
    }
    
    // Draw radial lines from center
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    for (let i = 0; i < stepCount; i++) {
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const endX = centerX + Math.cos(angle) * maxRadius;
      const endY = centerY + Math.sin(angle) * maxRadius;
      doc.line(centerX, centerY, endX, endY);
    }
    
    // Draw benchmark (Level 3) in light blue
    const benchmarkPoints = [];
    for (let i = 0; i < stepCount; i++) {
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const radius = (maxRadius * 3) / 4; // Level 3
      benchmarkPoints.push([
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      ]);
    }
    
    // Draw benchmark polygon with dashed line
    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(2);
    for (let i = 0; i < benchmarkPoints.length; i++) {
      const next = (i + 1) % benchmarkPoints.length;
      const [x1, y1] = benchmarkPoints[i];
      const [x2, y2] = benchmarkPoints[next];
      
      // Create dashed effect
      const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const segments = Math.floor(distance / 4);
      for (let s = 0; s < segments; s += 2) {
        const t1 = s / segments;
        const t2 = Math.min((s + 1) / segments, 1);
        doc.line(
          x1 + t1 * (x2 - x1), y1 + t1 * (y2 - y1),
          x1 + t2 * (x2 - x1), y1 + t2 * (y2 - y1)
        );
      }
    }
    
    // Draw actual performance polygon
    const performancePoints = [];
    for (let i = 0; i < stepCount; i++) {
      const step = steps[i];
      const stepLevel = unifiedStepLevels.find(ul => ul.stepId === step.id);
      const level = stepLevel ? stepLevel.level : 1;
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const radius = (maxRadius * level) / 4;
      performancePoints.push([
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      ]);
    }
    
    // Fill performance area with blue
    if (performancePoints.length > 0) {
      // Simple fill using triangular decomposition
      doc.setFillColor(59, 130, 246, 0.3);
      for (let i = 0; i < performancePoints.length; i++) {
        const next = (i + 1) % performancePoints.length;
        const [x1, y1] = performancePoints[i];
        const [x2, y2] = performancePoints[next];
        
        // Fill triangle from center to edge
        const steps = 20;
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const midX = centerX + t * (((x1 + x2) / 2) - centerX);
          const midY = centerY + t * (((y1 + y2) / 2) - centerY);
          const edgeX1 = centerX + t * (x1 - centerX);
          const edgeY1 = centerY + t * (y1 - centerY);
          const edgeX2 = centerX + t * (x2 - centerX);
          const edgeY2 = centerY + t * (y2 - centerY);
          
          doc.setDrawColor(59, 130, 246, 0.2);
          doc.setLineWidth(0.5);
          doc.line(edgeX1, edgeY1, edgeX2, edgeY2);
        }
      }
      
      // Draw performance polygon outline
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(3);
      for (let i = 0; i < performancePoints.length; i++) {
        const next = (i + 1) % performancePoints.length;
        doc.line(performancePoints[i][0], performancePoints[i][1], 
                performancePoints[next][0], performancePoints[next][1]);
      }
    }
    
    // Add step labels
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    for (let i = 0; i < stepCount; i++) {
      const angle = (i * 2 * Math.PI) / stepCount - Math.PI / 2;
      const labelRadius = maxRadius + 12;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius;
      
      const textWidth = doc.getTextWidth(stepLabels[i]);
      doc.text(stepLabels[i], labelX - textWidth / 2, labelY);
    }
    
    // Add legend
    const legendY = centerY + maxRadius + 25;
    doc.setFontSize(8);
    
    // Benchmark legend
    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(2);
    doc.line(centerX - 30, legendY, centerX - 20, legendY);
    doc.setTextColor(125, 211, 252);
    doc.text('Benchmark (Level 3)', centerX - 15, legendY + 2);
    
    // Performance legend  
    doc.setDrawColor(37, 99, 235);
    doc.line(centerX - 30, legendY + 8, centerX - 20, legendY + 8);
    doc.setTextColor(37, 99, 235);
    doc.text('Actual Performance', centerX - 15, legendY + 10);
    
    doc.setTextColor(0, 0, 0);
    
    yPosition += contextHeight + 15;

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