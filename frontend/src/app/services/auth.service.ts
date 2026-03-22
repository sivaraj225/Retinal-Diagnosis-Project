import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private BACKEND_URL = 'http://127.0.0.1:5000';

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.checkLoginStatus());
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() { }

  private checkLoginStatus(): boolean {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  private getUserFromStorage(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  login(email: string, pass: string): Observable<any> {
    return this.http.post<any>(`${this.BACKEND_URL}/api/login`, { email, password: pass }).pipe(
      tap(res => {
        if (res.user) {
          this.setSession(res.user);
        }
      })
    );
  }

  signup(name: string, email: string, pass: string): Observable<any> {
    return this.http.post<any>(`${this.BACKEND_URL}/api/signup`, { name, email, password: pass }).pipe(
      tap(res => {
        if (res.user) {
          this.setSession(res.user);
        }
      })
    );
  }

  private setSession(user: any) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.isLoggedInSubject.next(true);
    this.currentUserSubject.next(user);
    this.router.navigate(['/dashboard']);
  }

  logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getDoctorId(): string | null {
    return this.currentUserSubject.value?.doctor_id || null;
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.isLoggedInSubject.value;
  }
}
