import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { HttpClient } from '@angular/common/http';
import { CustomDateAdapter, APP_DATE_FORMATS } from '../../utils/date-adapter';
import { AuthService } from '../../services/auth.service';

const BACKEND_URL = 'http://127.0.0.1:5000';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS }
  ],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  isDragging = false;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isUploading = false;
  uploadError: string | null = null;

  // Patient Details
  patientName = '';
  patientId = '';
  age: number | null = null;
  gender = '';

  // Analysis State
  analysisComplete = false;
  analysisResult: any = null;

  ngOnInit() {
    this.generatePatientId();
  }

  generatePatientId() {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    this.patientId = `PT-${randomNum}`;
  }


  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File) {
    if (file.type.startsWith('image/')) {
      this.selectedFile = file;
      // Reset analysis if a new file is chosen
      this.analysisComplete = false;
      this.analysisResult = null;
      this.uploadError = null;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  handleAnalyzeClick() {
    if (!this.patientId || !this.patientName || !this.selectedFile) {
      alert('Please fill in the Patient ID, Name and upload an image before analysis.');
      return;
    }

    if (this.analysisComplete) {
      this.navigateToResults();
    } else {
      this.uploadImage();
    }
  }

  uploadImage() {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.uploadError = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);
    formData.append('patientName', this.patientName);
    formData.append('patientId', this.patientId);
    
    const doctorId = this.authService.getDoctorId();
    if (doctorId) {
      formData.append('doctorId', doctorId);
    }

    this.http.post<any>(`${BACKEND_URL}/predict`, formData).subscribe({
      next: (response: any) => {
        this.isUploading = false;
        this.analysisComplete = true;

        this.analysisResult = {
          explanation: response.explanation,
          predicted_disease: response.predicted_disease,
          predicted_disease_name: response.predicted_disease_name,
          top_probability: response.top_probability,
          risks: response.risks,
          diseases: response.diseases,
          shap_values: response.shap_values || []
        };

        this.navigateToResults();
      },
      error: (err: any) => {
        this.isUploading = false;
        const serverError = err.error?.error || err.message || 'Unknown error';
        
        if (err.status === 400) {
          this.uploadError = serverError;
        } else {
          this.uploadError = `Analysis failed: ${serverError}. Please ensure the backend server is running.`;
        }
        console.error('Prediction API error:', err);
      }
    });
  }

  navigateToResults() {
    if (this.analysisResult) {
      this.router.navigate(['/results'], {
        state: {
          data: this.analysisResult,
          image: this.previewUrl,
          patientDetails: {
            name: this.patientName,
            id: this.patientId,
            age: this.age,
            gender: this.gender

          }
        }
      });
    }
  }
}
