import { Component, AfterViewInit, ViewChild, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../services/auth.service';

export interface PatientRecord {
  id: string;
  name: string;
  date: string;
  condition: string;
  confidence: number;
  original_image?: string;
  explanation?: string;
  risks?: any[];
  _id?: string;
}

const BACKEND_URL = 'http://127.0.0.1:5000';

@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
<div class="report-dialog-content">
    <div class="header">
        <h2 mat-dialog-title>Diagnostic Report</h2>
        <button mat-icon-button (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
        </button>
    </div>

    <mat-dialog-content class="no-scroll">
        <div class="report-grid">
            <div class="scan-section">
                <div class="image-container">
                    <img [src]="data.original_image" alt="Patient Retinal Scan" class="scan-img">
                </div>
                <div class="patient-card">
                    <h3>Patient Information</h3>
                    <div class="info-row"><span class="label">Name:</span><span class="value">{{data.name}}</span></div>
                    <div class="info-row"><span class="label">Patient ID:</span><span class="value">{{data.id}}</span></div>
                    <div class="info-row"><span class="label">Scan Date:</span><span class="value">{{data.date}}</span></div>
                </div>
            </div>

            <div class="results-section">
                <div class="top-prediction">
                    <div class="prediction-label">Top AI Prediction</div>
                    <div class="prediction-value" [class]="getClass(data.confidence)">{{data.condition}}</div>
                    <div class="confidence-badge" [class]="getClass(data.confidence)">{{data.confidence}}% Confidence</div>
                </div>
                <div class="risks-list">
                    <h4>All Conditions Probabilities</h4>
                    @for (risk of data.risks; track risk.name) {
                    <div class="risk-item">
                        <div class="risk-info">
                            <span class="risk-name">{{risk.name}}</span>
                            <span class="risk-score" [class]="getClass(risk.probability)">{{risk.probability}}%</span>
                        </div>
                        <mat-progress-bar mode="determinate" [value]="risk.probability" [color]="getScoreColor(risk.probability)"></mat-progress-bar>
                    </div>
                    }
                </div>
                @if (data.explanation) {
                <div class="explanation-box">
                    <h4>Clinical Insight</h4>
                    <p>{{data.explanation}}</p>
                </div>
                }
            </div>
        </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Close</button>
        <button mat-raised-button color="primary" (click)="downloadReport()">
            <mat-icon>download</mat-icon> Download Report
        </button>
    </mat-dialog-actions>
</div>`,
  styles: [`
    .report-dialog-content { background: hsl(var(--hsl-background)); color: hsl(var(--hsl-text)); padding: 1rem; overflow: hidden; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .header h2 { margin: 0; font-weight: 600; }
    .report-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 2rem; }
    .image-container { width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid hsl(var(--hsl-border)); margin-bottom: 1.5rem; }
    .scan-img { width: 100%; height: 100%; object-fit: contain; }
    .patient-card { background: rgba(255, 255, 255, 0.05); padding: 1.25rem; border-radius: 12px; border: 1px solid hsl(var(--hsl-border)); }
    .patient-card h3 { margin: 0 0 1rem 0; font-size: 1rem; color: hsl(var(--hsl-primary)); }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .info-row .label { color: hsl(var(--hsl-text-muted)); }
    .top-prediction { text-align: center; background: rgba(255, 255, 255, 0.05); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid hsl(var(--hsl-border)); }
    .prediction-value { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.75rem; }
    .prediction-value.danger { color: hsl(var(--hsl-danger)); }
    .prediction-value.warning { color: hsl(var(--hsl-warning)); }
    .prediction-value.success { color: hsl(var(--hsl-success)); }
    .confidence-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
    .confidence-badge.danger { background: rgba(var(--rgb-danger), 0.1); color: hsl(var(--hsl-danger)); }
    .confidence-badge.warning { background: rgba(var(--rgb-warning), 0.1); color: hsl(var(--hsl-warning)); }
    .confidence-badge.success { background: rgba(var(--rgb-success), 0.1); color: hsl(var(--hsl-success)); }
    .risk-item { margin-bottom: 1rem; }
    .risk-info { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.9rem; }
    .risk-score.danger { color: hsl(var(--hsl-danger)); }
    .risk-score.warning { color: hsl(var(--hsl-warning)); }
    .risk-score.success { color: hsl(var(--hsl-success)); }
    .explanation-box { margin-top: 1.5rem; padding: 1.25rem; background: rgba(var(--rgb-primary), 0.05); border-radius: 12px; border: 1px solid rgba(var(--rgb-primary), 0.1); }
    .explanation-box p { margin: 0; font-size: 0.9rem; line-height: 1.5; color: hsl(var(--hsl-text-muted)); }
    .no-scroll { scrollbar-width: none; -ms-overflow-style: none; }
    .no-scroll::-webkit-scrollbar { display: none; }
  `]
})
export class ReportDialogComponent {
  private http = inject(HttpClient);
  constructor(@Inject(MAT_DIALOG_DATA) public data: any, public dialogRef: MatDialogRef<ReportDialogComponent>) {}
  getClass(score: number): string { if (score > 70) return 'danger'; if (score > 40) return 'warning'; return 'success'; }
  getScoreColor(score: number): string { if (score > 70) return 'warn'; if (score > 40) return 'accent'; return 'primary'; }

  downloadReport() {
    if (!this.data._id) return;
    const url = `${BACKEND_URL}/api/report/${this.data._id}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob: any) => {
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `Report_${this.data.id}.pdf`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (err: any) => {
        console.error('Download failed', err);
        alert('Failed to download report. Please try again.');
      }
    });
  }
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatDialogModule, ReportDialogComponent
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements AfterViewInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  displayedColumns: string[] = ['id', 'name', 'date', 'condition', 'confidence', 'actions'];
  dataSource = new MatTableDataSource<PatientRecord>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  filterValues = { text: '', date: '' };
  isLoading = false;
  private authService = inject(AuthService);

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (data: PatientRecord, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const textMatch = data.name.toLowerCase().includes(searchTerms.text) ||
        data.id.toLowerCase().includes(searchTerms.text) ||
        data.condition.toLowerCase().includes(searchTerms.text);
      const dateMatch = searchTerms.date ? data.date === searchTerms.date : true;
      return textMatch && dateMatch;
    }
    this.fetchHistory();
  }

  fetchHistory() {
    this.isLoading = true;
    const doctorId = this.authService.getDoctorId(); // Get doctorId from AuthService
    let url = `${BACKEND_URL}/api/history`;
    if (doctorId) {
      url += `?doctor_id=${doctorId}`;
    }
    
    this.http.get<any[]>(url).subscribe({
      next: (data: any[]) => {
        const records: PatientRecord[] = data.map((r: any) => ({
          id: r.patient_id,
          name: r.patient_name,
          date: r.date,
          condition: r.predicted_disease_name,
          confidence: r.probability,
          original_image: r.original_image,
          explanation: r.explanation,
          risks: r.risks,
          _id: r._id
        }));
        this.dataSource.data = records;
      },
      error: (err: any) => { console.error('Failed to fetch history', err); }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.filterValues.text = filterValue.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify(this.filterValues);
    if (this.dataSource.paginator) { this.dataSource.paginator.firstPage(); }
  }

  applyDateFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.filterValues.date = value ? value : '';
    this.dataSource.filter = JSON.stringify(this.filterValues);
    if (this.dataSource.paginator) { this.dataSource.paginator.firstPage(); }
  }

  viewReport(record: PatientRecord) {
    this.dialog.open(ReportDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: record,
      panelClass: 'report-dialog-container'
    });
  }

  downloadReport(record: PatientRecord) {
    if (!record._id) return;
    const url = `${BACKEND_URL}/api/report/${record._id}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob: any) => {
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `Report_${record.id}.pdf`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (err: any) => {
        console.error('Download failed', err);
        alert('Failed to download report. Please try again.');
      }
    });
  }
}
