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
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';

  private authService = inject(AuthService);

  onLogin(event: Event) {
    event.preventDefault();
    if (this.email && this.password) {
      this.authService.login(this.email, this.password).subscribe({
        next: () => {
          // Navigation happens inside AuthService
        },
        error: (err: any) => {
          console.error('Login failed', err);
          alert(err.error?.error || 'Login failed. Please check your credentials.');
        }
      });
    }
  }
}
