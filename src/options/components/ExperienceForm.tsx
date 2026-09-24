import React from 'react';
import { EducationExperience, WorkExperienceItem, EducationItem } from '../../types/profile';
import { Briefcase, GraduationCap, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface Props {
  data: EducationExperience;
  onChange: (data: EducationExperience) => void;
}

export default function ExperienceForm({ data, onChange }: Props) {
  // Normalize workHistory
  const workList: WorkExperienceItem[] =
    data.workHistory && data.workHistory.length > 0
      ? data.workHistory
      : [
          {
            id: 'work-default',
            jobTitle: data.currentTitle || '',
            company: data.currentCompany || '',
            location: '',
            currentlyWorkHere: true,
            from: '',
            to: '',
            description: '',
          },
        ];

  // Normalize educationHistory
  const eduList: EducationItem[] =
    data.educationHistory && data.educationHistory.length > 0
      ? data.educationHistory
      : [
          {
            id: 'edu-default',
            school: data.school || '',
            degree: data.degree || 'B.S.',
            discipline: data.discipline || 'Computer Science',
            gpa: data.gpa || '',
            from: '',
            to: data.graduationYear || '',
          },
        ];

  // Helper to commit changes while keeping root fields synchronized for backwards compatibility
  const commitChanges = (newWorkList: WorkExperienceItem[], newEduList: EducationItem[], yearsExp?: string) => {
    const primaryWork = newWorkList[0];
    const primaryEdu = newEduList[0];

    onChange({
      ...data,
      yearsOfExperience: yearsExp !== undefined ? yearsExp : data.yearsOfExperience,
      workHistory: newWorkList,
      educationHistory: newEduList,
      // Keep root fields synced for backwards compatibility with all autofill providers
      currentTitle: primaryWork ? primaryWork.jobTitle : '',
      currentCompany: primaryWork ? primaryWork.company : '',
      school: primaryEdu ? primaryEdu.school : '',
      degree: primaryEdu ? primaryEdu.degree : '',
      discipline: primaryEdu ? primaryEdu.discipline : '',
      gpa: primaryEdu ? primaryEdu.gpa : '',
      graduationYear: primaryEdu ? (primaryEdu.to || '') : '',
      highestDegree: primaryEdu ? primaryEdu.degree : data.highestDegree,
    });
  };

  // Work History Handlers
  const handleUpdateWorkItem = (index: number, field: keyof WorkExperienceItem, val: any) => {
    const updated = [...workList];
    updated[index] = { ...updated[index], [field]: val };
    commitChanges(updated, eduList);
  };

  const handleAddWorkItem = () => {
    const newItem: WorkExperienceItem = {
      id: `work-${Date.now()}`,
      jobTitle: '',
      company: '',
      location: '',
      currentlyWorkHere: false,
      from: '',
      to: '',
      description: '',
    };
    commitChanges([...workList, newItem], eduList);
  };

  const handleRemoveWorkItem = (index: number) => {
    if (workList.length <= 1) {
      // Clear the single entry instead of deleting completely
      const cleared: WorkExperienceItem = {
        id: `work-${Date.now()}`,
        jobTitle: '',
        company: '',
        location: '',
        currentlyWorkHere: true,
        from: '',
        to: '',
        description: '',
      };
      commitChanges([cleared], eduList);
      return;
    }
    const updated = workList.filter((_, i) => i !== index);
    commitChanges(updated, eduList);
  };

  // Education Handlers
  const handleUpdateEduItem = (index: number, field: keyof EducationItem, val: any) => {
    const updated = [...eduList];
    updated[index] = { ...updated[index], [field]: val };
    commitChanges(workList, updated);
  };

  const handleAddEduItem = () => {
    const newItem: EducationItem = {
      id: `edu-${Date.now()}`,
      school: '',
      degree: 'B.S.',
      discipline: '',
      gpa: '',
      from: '',
      to: '',
    };
    commitChanges(workList, [...eduList, newItem]);
  };

  const handleRemoveEduItem = (index: number) => {
    if (eduList.length <= 1) {
      const cleared: EducationItem = {
        id: `edu-${Date.now()}`,
        school: '',
        degree: '',
        discipline: '',
        gpa: '',
        from: '',
        to: '',
      };
      commitChanges(workList, [cleared]);
      return;
    }
    const updated = eduList.filter((_, i) => i !== index);
    commitChanges(workList, updated);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          Work Experience & Education
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Add your work history and education details. Instapp will autofill each experience card into Workday, Ashby, and other job applications.
        </p>
      </div>

      {/* Summary: Total Years of Experience */}
      <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Total Years of Experience
          </label>
          <p className="text-xs text-slate-500 mt-0.5">Used for general screening questions across job portals.</p>
        </div>
        <div className="w-36">
          <input
            type="text"
            value={data.yearsOfExperience || ''}
            onChange={(e) => commitChanges(workList, eduList, e.target.value)}
            placeholder="e.g. 4"
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-center"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WORK EXPERIENCE SECTION */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Work Experience ({workList.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddWorkItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Experience
          </button>
        </div>

        <div className="space-y-4">
          {workList.map((item, index) => (
            <div
              key={item.id || `work-${index}`}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {item.jobTitle || 'New Position'}{' '}
                    <span className="text-slate-500 font-normal">
                      {item.company ? `at ${item.company}` : ''}
                    </span>
                  </span>
                  {item.currentlyWorkHere && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Current
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveWorkItem(index)}
                  title="Remove this experience"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Job Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.jobTitle}
                    onChange={(e) => handleUpdateWorkItem(index, 'jobTitle', e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Company <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.company}
                    onChange={(e) => handleUpdateWorkItem(index, 'company', e.target.value)}
                    placeholder="e.g. NVIDIA"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={item.location || ''}
                    onChange={(e) => handleUpdateWorkItem(index, 'location', e.target.value)}
                    placeholder="e.g. Austin, TX"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Currently Work Here Checkbox */}
                <div className="flex items-center pt-6">
                  <label className="relative flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!item.currentlyWorkHere}
                      onChange={(e) => handleUpdateWorkItem(index, 'currentlyWorkHere', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-700">I currently work here</span>
                  </label>
                </div>

                {/* From Date (MM/YYYY) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    From <span className="text-rose-500">*</span>{' '}
                    <span className="text-slate-400 font-normal lowercase">(MM/YYYY)</span>
                  </label>
                  <input
                    type="text"
                    value={item.from || ''}
                    onChange={(e) => handleUpdateWorkItem(index, 'from', e.target.value)}
                    placeholder="e.g. 06/2023"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* To Date (MM/YYYY) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    To{' '}
                    <span className="text-slate-400 font-normal lowercase">(MM/YYYY)</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!item.currentlyWorkHere}
                    value={item.currentlyWorkHere ? 'Present' : (item.to || '')}
                    onChange={(e) => handleUpdateWorkItem(index, 'to', e.target.value)}
                    placeholder="e.g. 08/2024"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono ${
                      item.currentlyWorkHere
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-800 border-slate-300'
                    }`}
                  />
                </div>

                {/* Role Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Role Description
                  </label>
                  <textarea
                    rows={3}
                    value={item.description || ''}
                    onChange={(e) => handleUpdateWorkItem(index, 'description', e.target.value)}
                    placeholder="Describe your core responsibilities, achievements, technologies used, and key impact..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Experience Button at Bottom */}
        <button
          type="button"
          onClick={handleAddWorkItem}
          className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Another Work Experience
        </button>
      </div>

      {/* ========================================================================= */}
      {/* EDUCATION SECTION */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Education ({eduList.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddEduItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Education
          </button>
        </div>

        <div className="space-y-4">
          {eduList.map((item, index) => (
            <div
              key={item.id || `edu-${index}`}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {item.school || 'School / University'}{' '}
                    <span className="text-slate-500 font-normal">
                      {item.degree ? `(${item.degree})` : ''}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveEduItem(index)}
                  title="Remove this education entry"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* School */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    School / University <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.school}
                    onChange={(e) => handleUpdateEduItem(index, 'school', e.target.value)}
                    placeholder="e.g. University of Texas at Austin"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Degree */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Degree <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.degree}
                    onChange={(e) => handleUpdateEduItem(index, 'degree', e.target.value)}
                    placeholder="e.g. Bachelor of Science (B.S.)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Field of Study */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Field of Study / Major <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.discipline}
                    onChange={(e) => handleUpdateEduItem(index, 'discipline', e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* GPA */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Overall Result / GPA
                  </label>
                  <input
                    type="text"
                    value={item.gpa || ''}
                    onChange={(e) => handleUpdateEduItem(index, 'gpa', e.target.value)}
                    placeholder="e.g. 3.85"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* From Year */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    From Year <span className="text-slate-400 font-normal lowercase">(YYYY)</span>
                  </label>
                  <input
                    type="text"
                    value={item.from || ''}
                    onChange={(e) => handleUpdateEduItem(index, 'from', e.target.value)}
                    placeholder="e.g. 2022"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* To / Grad Year */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    To / Graduation Year <span className="text-slate-400 font-normal lowercase">(YYYY)</span>
                  </label>
                  <input
                    type="text"
                    value={item.to || ''}
                    onChange={(e) => handleUpdateEduItem(index, 'to', e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Education Button at Bottom */}
        <button
          type="button"
          onClick={handleAddEduItem}
          className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Another Education
        </button>
      </div>
    </div>
  );
}
