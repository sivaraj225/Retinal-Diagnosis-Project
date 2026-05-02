import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';

interface RiskFactor {
  name: string;
  score: number;
  level: string;
  code?: string;
  fullName?: string;
  description?: string;
  color?: string;
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, MatIconModule, MatTabsModule, MatTooltipModule, BaseChartDirective],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent implements OnInit {
  private router = inject(Router);

  // Filter State
  currentFilter = 'none';
  filterStyle = 'none';

  setFilter(filter: string) {
    this.currentFilter = filter;
    switch (filter) {
      case 'red-free':
        // Green-like filter to simulate Red-Free
        this.filterStyle = 'grayscale(100%) sepia(100%) hue-rotate(100deg) saturate(300%) contrast(1.2)';
        break;
      case 'invert':
        this.filterStyle = 'invert(100%)';
        break;
      case 'contrast':
        this.filterStyle = 'contrast(150%) saturate(150%)'; // Adjusted
        break;
      default:
        this.filterStyle = 'none';
    }
  }

  // ... existing properties ...

  // Trend Chart Data
  trendChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Today'],
    datasets: [
      {
        data: [15, 18, 25, 45, 60, 75, 82], // Mock trend showing progression
        label: 'Risk Score Trend (%)',
        fill: true,
        tension: 0.4,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        pointBackgroundColor: '#f43f5e',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#f43f5e'
      }
    ]
  };

  trendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#9ca3af' } },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: '#9ca3af' },
        grid: { display: false } // Cleaner look
      }
    }
  };

  // Default Mock Data if no state is passed
  originalImage = '';
  heatmapImage = '';
  patientDetails: any = null;
  explanation = 'No analysis data available. Please upload a scan.';
  shapValues: { feature: string, value: number }[] = [];

  risks: RiskFactor[] = [];

  ngOnInit() {
    const state = history.state;

    if (state && state.data) {
      if (state.data.explanation) {
        this.explanation = state.data.explanation;
      }
      if (state.data.shap_values) {
        this.shapValues = state.data.shap_values;
      }

      // Prefer using the rich 'diseases' array from backend (has code, color, probability)
      if (state.data.diseases && state.data.diseases.length > 0) {
        this.risks = state.data.diseases.map((d: any) => ({
          name: `${d.code} — ${d.name}`,
          score: Math.round(d.probability),
          level: this.getLevel(d.probability),
          color: d.color,
          description: d.description,
          code: d.code,
          fullName: d.name
        }));
      } else if (state.data.risks) {
        // Fallback: Map risks object { 'Cond': 80, ... } to array format
        const risksObj = state.data.risks;
        this.risks = Object.keys(risksObj).map(key => ({
          name: key,
          score: Math.round(risksObj[key]),
          level: this.getLevel(risksObj[key])
        }));
      }
    }

    if (state && state.image) {
      this.originalImage = state.image;
    }

    if (state && state.patientDetails) {
      this.patientDetails = state.patientDetails;
    }
  }

  getLevel(score: number): string {
    if (score > 70) return 'High Risk';
    if (score > 40) return 'Moderate Risk';
    return 'Low Risk';
  }

  getScoreColor(score: number): string {
    if (score > 70) return 'warn';
    if (score > 40) return 'accent';
    return 'primary';
  }

  // Slider State
  sliderPosition = 50;

  updateSlider(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.sliderPosition = parseInt(val, 10);
  }

  // Custom class helper for color binding in template styling if needed
  getClass(score: number): string {
    if (score > 70) return 'high';
    if (score > 40) return 'moderate';
    return 'low';
  }

  downloadReport() {
    const data = document.querySelector('.results-container') as HTMLElement;
    if (data) {
      html2canvas(data, { scale: 2, useCORS: true }).then(canvas => {
        const imgWidth = 208;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');

        // Add Header
        pdf.setFontSize(18);
        pdf.text('Retinal Analysis Report', 10, 10);
        pdf.setFontSize(12);
        pdf.text(`Date: ${new Date().toLocaleDateString()}`, 10, 18);

        pdf.addImage(imgData, 'PNG', 0, 25, imgWidth, imgHeight);
        pdf.save('retinal-diagnosis-report.pdf');
      });
    }
  }
}
