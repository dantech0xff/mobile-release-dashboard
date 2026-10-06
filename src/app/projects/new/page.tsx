import ProjectForm from "../ProjectForm";

export const dynamic = "force-dynamic";

export default function NewProject() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New project</h1>
      <ProjectForm />
    </div>
  );
}
