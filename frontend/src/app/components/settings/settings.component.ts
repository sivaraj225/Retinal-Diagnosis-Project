import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  isDark$ = this.themeService.isDark$;

  userProfile = {
    name: this.authService.getCurrentUser()?.name || 'Doctor',
    email: this.authService.getCurrentUser()?.email || '',
    role: 'Retinal Specialist',
    avatar: 'assets/doctor_avatar.png'
  };

  toggleDarkMode(checked: boolean) {
    this.themeService.toggleTheme(checked);
  }

  updateProfile() {
    // Mock update logic
    console.log('Profile updated', this.userProfile);
  }
}
