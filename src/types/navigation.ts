export type AuthStackParamList = {
    Login: undefined;
    ForgotPasswordEmail: undefined;
    ForgotPasswordOtp: { email: string };
    ForgotPasswordReset: { email: string; resetToken: string; expiresAt?: string };
};

export type JobDetailsParams = {
    jobId: string;
};

export type ActiveJobsStackParamList = {
    ActiveJobs: undefined;
    JobDetails: JobDetailsParams;
};

export type UpcomingJobsStackParamList = {
    UpcomingJobs: undefined;
    JobDetails: JobDetailsParams;
};

export type HistoryJobsStackParamList = {
    HistoryJobs: undefined;
    JobDetails: JobDetailsParams;
};

export type MainTabParamList = {
    ActiveJobsTab: undefined;
    UpcomingJobsTab: undefined;
    HistoryJobsTab: undefined;
    SupportTab: undefined;
    ProfileTab: undefined;
};

export type ProfileStackParamList = {
    DriverProfile: undefined;
};

export type SupportStackParamList = {
    SupportTickets: undefined;
    SupportTicketDetails: { ticketId: string };
    NewSupportTicket: undefined;
};
