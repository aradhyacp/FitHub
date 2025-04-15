import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, DollarSign, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { formatDate } from '../lib/utils';

interface UserProfile {
  full_name: string;
  email: string;
}

interface Membership {
  name: string;
  end_date: string;
  trainer_name: string;
}

interface Workout {
  name: string;
  assigned_date: string;
  completed_date: string | null;
  exercises: any;
}

export default function ClientDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const { data: membershipData } = await supabase
        .from('active_memberships')
        .select('name, end_date, trainer_name')
        .eq('user_id', user.id)
        .single();

      const { data: workoutData } = await supabase
        .from('user_workouts')
        .select(`
          workouts (name, exercises),
          assigned_date,
          completed_date
        `)
        .eq('user_id', user.id)
        .order('assigned_date', { ascending: false })
        .limit(5);

      setProfile(profileData);
      setMembership(membershipData);
      setWorkouts(workoutData?.map((w) => ({
        name: w.workouts.name,
        exercises: w.workouts.exercises,
        assigned_date: w.assigned_date,
        completed_date: w.completed_date,
      })) || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="text-white">Client area</div>
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Membership</h3>
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {membership?.name || 'No active membership'}
            </p>
            {membership && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Expires: {formatDate(new Date(membership.end_date))}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trainer</h3>
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {membership?.trainer_name || 'No trainer assigned'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Next Payment</h3>
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {membership ? formatDate(new Date(membership.end_date)) : 'N/A'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workouts</h3>
              <Activity className="h-6 w-6 text-primary-600" />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {workouts.length} Recent Workouts
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
              Recent Workouts
            </h2>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {workouts.map((workout, index) => (
                <div key={index} className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        {workout.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Assigned: {formatDate(new Date(workout.assigned_date))}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        workout.completed_date
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                      }`}
                    >
                      {workout.completed_date ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}