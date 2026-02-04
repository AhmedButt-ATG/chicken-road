import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse,
} from '@angular/common/http';
@Injectable({
  providedIn: 'root',
})
export class ApiCallService {
  constructor(private http: HttpClient) {}
  // Dev Url
  private baseRoute = 'https://154.38.171.150:44396/api/';

  // Live url
  // private baseRoute = 'https://209.145.48.167:44363/api/';

  PostCallWithoutToken(Payload: any, apiroute: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    var finalroute = this.baseRoute + apiroute;
    var response = this.http
      .post<any>(finalroute, Payload, { headers })
      .pipe(catchError(this.handleError));
    // console.log(response);
    return response;
  }
  PostCallWithToken(Payload: any, apiroute: string): Observable<any> {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJFbWFpbCI6ImFzLndvcmRzZW5zZTIuMEBnbWFpbC5jb20iLCJJRCI6IjE5IiwiVHlwZSI6ImN1c3RvbWVyIiwiSXNNb2JpbGVVc2VyIjoiVHJ1ZSIsIkNvbnRleHQiOiJTb2NpYWxBcHAiLCJQYW5lbFR5cGUiOiJjdXN0b21lciIsIkRldmljZUlkIjoic3RyaW5nIiwiZXhwIjoxNzcwNTY2MDczLCJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo3MjM5IiwiYXVkIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NzIzOSJ9.1Yx2jjnFj5jOf3C_at0E9Ba4vrOYTvm2eiLommWhGZ8';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    headers.set('Authorization', `Bearer ${token}`);
    var finalroute = this.baseRoute + apiroute;
    var response = this.http
      .post<any>(finalroute, Payload, { headers })
      .pipe(catchError(this.handleError));
    // console.log(response);
    return response;
  }
  GetCallWithoutToken(apiroute: string): Observable<any> {
    var apiurl = this.baseRoute + apiroute;
    var response = this.http
      .get<any>(apiurl)
      .pipe(catchError(this.handleError));
    // console.log(response);
    return response;
  }
  GetCallWithToken(apiroute: string): Observable<any> {
    var apiurl = this.baseRoute + apiroute;
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJFbWFpbCI6ImFzLndvcmRzZW5zZTIuMEBnbWFpbC5jb20iLCJJRCI6IjE5IiwiVHlwZSI6ImN1c3RvbWVyIiwiSXNNb2JpbGVVc2VyIjoiVHJ1ZSIsIkNvbnRleHQiOiJTb2NpYWxBcHAiLCJQYW5lbFR5cGUiOiJjdXN0b21lciIsIkRldmljZUlkIjoic3RyaW5nIiwiZXhwIjoxNzcwNTY2MDczLCJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo3MjM5IiwiYXVkIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NzIzOSJ9.1Yx2jjnFj5jOf3C_at0E9Ba4vrOYTvm2eiLommWhGZ8';

    // Create headers and append the token
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    var response = this.http
      .get<any>(apiurl, { headers })
      .pipe(catchError(this.handleError));
    // console.log(response);
    return response;
  }
  handleError(error: HttpErrorResponse) {
    if (error.status === 400) {
      // If status is 400, user already exists
      return throwError('User already exists');
    } else {
      // For other errors, log the error and throw a generic message
      // console.error('An error occurred:', error.error);
      return throwError('Something went wrong. Please try again later.');
    }
  }
}
