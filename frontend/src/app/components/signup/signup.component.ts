import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  name = '';
  email = '';
  password = '';

  private authService = inject(AuthService);

  onSignup(event: Event) {
    event.preventDefault();
    if (this.name && this.email && this.password) {
      this.authService.signup(this.name, this.email, this.password).subscribe({
        next: () => {
          // Navigation happens inside AuthService
        },
        error: (err: any) => {
          console.error('Signup failed', err);
          alert(err.error?.error || 'Signup failed. Please try again.');
        }
      });
    }
  }
}
