export class RequestToRegisterUserProfile {
  email: string;
  password: string;
  fullname: string;
  phone: string;

  constructor(email: string, password: string, fullname: string, phone: string) {
    this.email = email;
    this.password = password;
    this.fullname = fullname;
    this.phone = phone;
  }
}
