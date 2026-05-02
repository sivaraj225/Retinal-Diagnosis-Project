import { Component, OnInit, inject, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { HttpClient } from '@angular/common/http';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { ReportDialogComponent, PatientRecord } from '../history/history.component';
import { AuthService } from '../../services/auth.service';

interface PatientScan extends PatientRecord {
  risk: 'High' | 'Moderate' | 'Low';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatPaginatorModule,
    MatMenuModule,
    MatDialogModule,
    BaseChartDirective
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  stats = [
    { title: 'Total Scans', value: '...', icon: 'visibility', color: 'hsl(var(--hsl-primary))' },
    { title: 'High Risk Cases', value: '...', icon: 'warning', color: 'hsl(var(--hsl-danger))' },
    { title: 'Avg Confidence', value: '...', icon: 'verified', color: 'hsl(var(--hsl-success))' },
    { title: 'New Patients', value: '...', icon: 'group_add', color: 'hsl(var(--hsl-secondary))' }
  ];

  // Pie Chart (Disease Distribution)
  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#9ca3af' } }
    }
  };
  public pieChartLabels = ['Diabetic Retinopathy', 'Glaucoma', 'Hypertension', 'Healthy', 'Cataract'];
  public pieChartDatasets = [{
    data: [35, 20, 15, 20, 10],
    backgroundColor: [
      '#ef4444', // Red (DR)
      '#f59e0b', // Amber (Glaucoma)
      '#6366f1', // Indigo (Hyper)
      '#10b981', // Green (Healthy)
      '#ec4899', // Pink (Cataract)
    ],
    borderWidth: 0
  }];

  // Line Chart (Daily Activity)
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Jan 07', 'Jan 08', 'Jan 09', 'Jan 10', 'Jan 11', 'Jan 12', 'Jan 13'],
    datasets: [
      {
        data: [18, 24, 21, 28, 32, 25, 30],
        label: 'Scans Processed',
        fill: true,
        tension: 0.4,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        pointBackgroundColor: '#06b6d4'
      }
    ]
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    },
    plugins: {
      legend: { display: false }
    }
  };

  allScans: PatientScan[] = [];

  recentScans = new MatTableDataSource<PatientScan>([]);
  displayedColumns: string[] = ['id', 'name', 'condition', 'date', 'action'];

  constructor() {
    this.allScans = [];
  }

  getRecentDate(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }

  filterRecentScans() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const filtered = this.allScans.filter(scan => new Date(scan.date) >= oneWeekAgo);
    this.recentScans.data = filtered;
  }

  ngOnInit() {
    this.filterRecentScans();
    const doctorId = this.authService.getDoctorId();
    const authQuery = doctorId ? `?doctor_id=${doctorId}` : '';

    this.http.get<any>(`http://127.0.0.1:5000/api/stats${authQuery}`).subscribe({
      next: (data: any) => {
        this.stats = [
          { ...this.stats[0], value: data.total_scans?.toLocaleString() || '0' },
          { ...this.stats[1], value: data.high_risk_cases?.toString() || '0' },
          { ...this.stats[2], value: (data.avg_confidence || 0) + '%' },
          { ...this.stats[3], value: data.new_patients?.toString() || '0' }
        ];

        // Update Pie Chart Data
        if (data.pie_chart) {
          this.pieChartLabels = data.pie_chart.labels;
          this.pieChartDatasets = [{
            ...this.pieChartDatasets[0],
            data: data.pie_chart.data
          }];
        }

        // Update Line Chart Data
        if (data.line_chart) {
          this.lineChartData = {
            labels: data.line_chart.labels,
            datasets: [{
              ...this.lineChartData.datasets[0],
              data: data.line_chart.data
            }]
          };
        }
      },
      error: (err: any) => {
        console.error('Failed to fetch dashboard stats', err);
        this.stats = [
          { ...this.stats[0], value: '0' },
          { ...this.stats[1], value: '0' },
          { ...this.stats[2], value: '0%' },
          { ...this.stats[3], value: '0' }
        ];
      }
    });

    this.http.get<any[]>(`http://127.0.0.1:5000/api/history${authQuery}`).subscribe({
      next: (data: any[]) => {
        this.allScans = data.map((record: any) => ({
          id: record.patient_id,
          name: record.patient_name,
          date: record.date,
          risk: record.probability > 70 ? 'High' : (record.probability > 40 ? 'Moderate' : 'Low'),
          condition: record.predicted_disease_name,
          confidence: record.probability,
          original_image: record.original_image,
          explanation: record.explanation,
          risks: record.risks,
          _id: record._id
        }));
        this.filterRecentScans();
      },
      error: (err: any) => {
        console.error('Failed to fetch history for dashboard', err);
      }
    });
  }

  ngAfterViewInit() {
    this.recentScans.paginator = this.paginator;
  }

  viewReport(record: PatientScan) {
    this.dialog.open(ReportDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: record,
      panelClass: 'report-dialog-container'
    });
  }

  getRiskColor(risk: string): string {
    switch (risk) {
      case 'High': return 'warn';
      case 'Moderate': return 'accent';
      case 'Low': return 'primary';
      default: return 'primary';
    }
  }
}
