import { Profile } from "@/components/Profile";

export const metadata = { title: "Profile — almost." };

export default function ProfilePage() {
  return (
    <div className="animate-fade-in space-y-6 pt-6 sm:pt-12">
      <p className="label">Observer profile</p>
      <Profile />
    </div>
  );
}
