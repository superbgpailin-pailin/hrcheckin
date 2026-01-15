import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ProfileForm } from '../components/ProfileForm';

export const MyProfile: React.FC = () => {
    const { currentUser } = useAuth();

    if (!currentUser) return <div>Loading...</div>;

    return (
        <div className="my-profile-page">
            <ProfileForm initialData={currentUser} />
        </div>
    );
};
