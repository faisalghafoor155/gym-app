export interface TrainerForm {
  name: string;
  phone: string;
  specialization: string;
  commissionPercentage: number;
  /** Empty means "use the gym default", which is not the same as 0. */
  ptFee: string;
}

export const emptyTrainerForm: TrainerForm = {
  name: '',
  phone: '',
  specialization: '',
  commissionPercentage: 10,
  ptFee: '',
};

export interface PtSessionForm {
  memberId: string;
  trainerId: string;
  sessionDate: string;
  priceCharged: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
}

export const emptyPtForm = (): PtSessionForm => ({
  memberId: '',
  trainerId: '',
  sessionDate: new Date().toISOString().substring(0, 16),
  priceCharged: 2000,
  status: 'scheduled',
  paymentStatus: 'unpaid',
});

export type TabType = 'trainers' | 'bookings' | 'commissions' | 'payouts';
