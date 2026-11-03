"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Company = { id: string; name: string };
type Member = {
  id: string;
  role: "ADMIN" | "STAFF";
  operatorId: string;
  operatorName: string;
  name: string;
  email: string;
};

export default function AdminBusCompanyAccounts({
  companies,
  members,
  action,
  selectedCompanyId: initialCompanyId,
}: {
  companies: Company[];
  members: Member[];
  action: (formData: FormData) => void | Promise<void>;
  selectedCompanyId: string;
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const router = useRouter();
  function selectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    const query = new URLSearchParams(window.location.search);
    query.set("company", companyId);
    query.delete("memberPage");
    router.push(`/admin?${query.toString()}#bus-companies`);
  }
  const companyMembers = members.filter((member) => member.operatorId === selectedCompanyId);

  return <>
    <h3 className="dashboard-subheading">Assign a company account</h3>
    <form action={action} className="dashboard-form">
      <label className="field"><span>Bus company</span><select name="operatorId" required value={selectedCompanyId} onChange={(event) => selectCompany(event.target.value)}><option value="" disabled>Select a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      <label className="field"><span>Account holder name (new accounts)</span><input name="name" minLength={2} maxLength={100}/></label>
      <label className="field"><span>Account email</span><input name="email" type="email" required/></label>
      <label className="field"><span>Access level</span><select name="memberRole" required defaultValue="STAFF"><option value="ADMIN">Company administrator</option><option value="STAFF">Local staff</option></select></label>
      <label className="field"><span>Password <em>(required for new accounts)</em></span><input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128}/></label>
      <label className="field"><span>Re-enter password <em>(required for new accounts)</em></span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128}/></label>
      <button className="btn btn-secondary" type="submit">Assign or create account</button>
    </form>
    <h3 className="dashboard-subheading">{companies.find((company) => company.id === selectedCompanyId)?.name ?? "Company"} staff</h3>
    {companyMembers.length ? <div className="dashboard-list">{companyMembers.map((member) => <article className="dashboard-list-item" key={member.id}><div><strong>{member.name} · {member.role === "ADMIN" ? "Company administrator" : "Local staff"}</strong><span>{member.email} · {member.operatorName}</span></div></article>)}</div> : <p className="field-hint">{selectedCompanyId ? "No staff are assigned to this company yet." : "Select a company to view its staff."}</p>}
  </>;
}
