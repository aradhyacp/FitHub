import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, DollarSign, Activity, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { formatDate, formatCurrency } from '../lib/utils';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  upcomingRenewals: number;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  membership_name: string;
  trainer_name: string | null;
  end_date: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    totalRevenue: 0,
    upcomingRenewals: 0,
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch dashboard statistics
      const { data: membersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' });

      const { data: activeMemberships } = await supabase
        .from('user_memberships')
        .select('id', { count: 'exact' })
        .eq('status', 'active');

      const { data: revenue } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');

      const { data: renewals } = await supabase
        .from('upcoming_renewals')
        .select('id', { count: 'exact' });

      // Fetch recent members
      const { data: recentMembers } = await supabase
        .from('active_memberships')
        .select(`
          user_id,
          profiles!inner(full_name, email),
          membership_name,
          trainer_name,
          end_date
        `)
        .order('end_date', { ascending: true })
        .limit(10);

      setStats({
        totalMembers: membersCount?.count || 0,
        activeMembers: activeMemberships?.count || 0,
        totalRevenue: revenue?.reduce((sum, payment) => sum + payment.amount, 0) || 0,
        upcomingRenewals: renewals?.count || 0,
      });

      setMembers(
        recentMembers?.map((member) => ({
          id: member.user_id,
          full_name: member.profiles.full_name,
          email: member.profiles.email,
          membership_name: member.membership_name,
          trainer_name: member.trainer_name,
          end_date: member.end_date,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar isAdmin />
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Members</h3>
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalMembers}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {stats.activeMembers} active
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Revenue</h3>
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upcoming Renewals
              </h3>
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.upcomingRenewals}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Next 30 days</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Plans</h3>
              <Activity className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.activeMembers}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent Members
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Name
                    </th>
                    <th className="pb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Email
                    </th>
                    <th className="pb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Membership
                    </th>
                    <th className="pb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Trainer
                    </th>
                    <th className="pb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Expiry
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="py-4 text-sm text-gray-900 dark:text-white">
                        {member.full_name}
                      </td>
                      <td className="py-4 text-sm text-gray-600 dark:text-gray-300">
                        {member.email}
                      </td>
                      <td className="py-4 text-sm text-gray-600 dark:text-gray-300">
                        {member.membership_name}
                      </td>
                      <td className="py-4 text-sm text-gray-600 dark:text-gray-300">
                        {member.trainer_name || 'Not assigned'}
                      </td>
                      <td className="py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(new Date(member.end_date))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}