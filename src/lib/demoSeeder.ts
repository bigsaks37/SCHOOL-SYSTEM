import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function computeBece(total: number): { grade: string; remarks: string } {
  if (total >= 80) return { grade: "1", remarks: "Highest" };
  if (total >= 70) return { grade: "2", remarks: "Higher" };
  if (total >= 65) return { grade: "3", remarks: "High" };
  if (total >= 60) return { grade: "4", remarks: "High Average" };
  if (total >= 55) return { grade: "5", remarks: "Average" };
  if (total >= 50) return { grade: "6", remarks: "Low Average" };
  if (total >= 45) return { grade: "7", remarks: "Low" };
  if (total >= 40) return { grade: "8", remarks: "Lower" };
  return { grade: "9", remarks: "Lowest" };
}

function primaryLetterGrade(total: number): { grade: string; remarks: string } {
  if (total >= 80) return { grade: "A", remarks: "Excellent" };
  if (total >= 70) return { grade: "B", remarks: "Very Good" };
  if (total >= 60) return { grade: "C", remarks: "Good" };
  if (total >= 50) return { grade: "D", remarks: "Credit" };
  if (total >= 40) return { grade: "E", remarks: "Pass" };
  return { grade: "F", remarks: "Needs Improvement" };
}

/**
 * Idempotent Ghanaian Private Basic School Demo Data Seeder.
 * Used both by `prisma/seed.ts` (CLI) and `POST /api/admin/seed-demo` (one-click UI button).
 */
export async function seedGhanaSchoolDemo(prisma: PrismaClient) {
  // 1. School Profile
  await prisma.schoolProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      schoolName: "Sankofa Preparatory & JHS",
      motto: "Excellence, Integrity & Service",
      address: "Plot 14, East Legon, Accra, Ghana",
      phone: "+233 30 255 0148",
      email: "admin@sankofaschool.edu.gh",
      gesCode: "GES-GA-0419",
      currency: "GHS",
    },
  });

  // 2. Users (Headmaster, Accountant, 4 Teachers, 2 Multi-Child Parents)
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const headmaster = await prisma.user.upsert({
    where: { email: "headmaster@sankofa.edu.gh" },
    update: { staffId: "ADM-2026-001", isActive: true },
    create: {
      staffId: "ADM-2026-001",
      fullName: "Mr. Kwame Mensah-Bonsu",
      email: "headmaster@sankofa.edu.gh",
      phone: "+233 24 410 2200",
      qualification: "M.Ed Educational Leadership",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const bursar = await prisma.user.upsert({
    where: { email: "bursar@sankofa.edu.gh" },
    update: { staffId: "ACC-2026-001", isActive: true },
    create: {
      staffId: "ACC-2026-001",
      fullName: "Mrs. Abena Osei-Tutu",
      email: "bursar@sankofa.edu.gh",
      phone: "+233 20 812 3344",
      qualification: "B.Sc Accounting (ICAG)",
      passwordHash,
      role: "BURSAR",
      isActive: true,
    },
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: "teacher@sankofa.edu.gh" },
    update: {
      staffId: "STF-2026-001",
      subjects: "Mathematics, Integrated Science, Computing (ICT)",
      qualification: "B.Ed Mathematics & Science",
    },
    create: {
      staffId: "STF-2026-001",
      fullName: "Mr. Kojo Boateng",
      email: "teacher@sankofa.edu.gh",
      phone: "+233 54 221 9087",
      qualification: "B.Ed Mathematics & Science",
      subjects: "Mathematics, Integrated Science, Computing (ICT)",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: "efua.asante@sankofa.edu.gh" },
    update: {
      staffId: "STF-2026-002",
      subjects: "English Language, Our World Our People, Creative Arts & Design",
      qualification: "B.Ed Early Childhood Education",
    },
    create: {
      staffId: "STF-2026-002",
      fullName: "Ms. Efua Asante",
      email: "efua.asante@sankofa.edu.gh",
      phone: "+233 27 654 1120",
      qualification: "B.Ed Early Childhood Education",
      subjects: "English Language, Our World Our People, Creative Arts & Design",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const teacher3 = await prisma.user.upsert({
    where: { email: "gideon.tetteh@sankofa.edu.gh" },
    update: {
      staffId: "STF-2026-003",
      subjects:
        "Social Studies, Religious & Moral Education, Ghanaian Language (Twi/Ga)",
      qualification: "Diploma in Basic Education",
    },
    create: {
      staffId: "STF-2026-003",
      fullName: "Mr. Gideon Tetteh",
      email: "gideon.tetteh@sankofa.edu.gh",
      phone: "+233 24 778 5412",
      qualification: "Diploma in Basic Education",
      subjects:
        "Social Studies, Religious & Moral Education, Ghanaian Language (Twi/Ga)",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const teacher4 = await prisma.user.upsert({
    where: { email: "comfort.adjei@sankofa.edu.gh" },
    update: {
      staffId: "STF-2026-004",
      subjects: "Early Years Literacy, Numeracy, Creative Arts & Design",
      qualification: "Cert. Early Childhood Care",
    },
    create: {
      staffId: "STF-2026-004",
      fullName: "Mrs. Comfort Adjei",
      email: "comfort.adjei@sankofa.edu.gh",
      phone: "+233 55 890 1123",
      qualification: "Cert. Early Childhood Care",
      subjects: "Early Years Literacy, Numeracy, Creative Arts & Design",
      passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const parent1 = await prisma.user.upsert({
    where: { email: "parent@sankofa.edu.gh" },
    update: { phone: "+233 24 900 4411" },
    create: {
      fullName: "Mr. Yaw Owusu-Ansah",
      email: "parent@sankofa.edu.gh",
      phone: "+233 24 900 4411",
      passwordHash,
      role: "PARENT",
      isActive: true,
    },
  });

  const parent2 = await prisma.user.upsert({
    where: { email: "ama.darko@gmail.com" },
    update: { phone: "+233 55 310 7788" },
    create: {
      fullName: "Mrs. Ama Darko",
      email: "ama.darko@gmail.com",
      phone: "+233 55 310 7788",
      passwordHash,
      role: "PARENT",
      isActive: true,
    },
  });

  // 3. Academic Terms
  const currentTerm = await prisma.academicTerm.upsert({
    where: {
      academicYear_termName: {
        academicYear: "2026/2027",
        termName: "Term 1",
      },
    },
    update: {
      isCurrent: true,
      nextTermReopeningDate: "2027-01-12",
      classScoreWeight: 50,
      primaryGradingScale: "LETTER",
    },
    create: {
      academicYear: "2026/2027",
      termName: "Term 1",
      startDate: "2026-09-08",
      endDate: "2026-12-18",
      nextTermReopeningDate: "2027-01-12",
      classScoreWeight: 50,
      primaryGradingScale: "LETTER",
      isCurrent: true,
    },
  });

  await prisma.academicTerm.upsert({
    where: {
      academicYear_termName: {
        academicYear: "2026/2027",
        termName: "Term 2",
      },
    },
    update: { nextTermReopeningDate: "2027-05-04" },
    create: {
      academicYear: "2026/2027",
      termName: "Term 2",
      startDate: "2027-01-12",
      endDate: "2027-04-16",
      nextTermReopeningDate: "2027-05-04",
      classScoreWeight: 50,
      primaryGradingScale: "LETTER",
      isCurrent: false,
    },
  });

  // 4. Department Subjects & Learning Areas
  const departmentSubjectsSeed: Array<{
    department: "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";
    name: string;
    category: "CORE" | "ELECTIVE" | "LEARNING_AREA";
  }> = [
    { department: "KINDERGARTEN", name: "Phonics & Early Literacy", category: "LEARNING_AREA" },
    { department: "KINDERGARTEN", name: "Numeracy", category: "LEARNING_AREA" },
    { department: "KINDERGARTEN", name: "Creative Arts", category: "LEARNING_AREA" },
    { department: "KINDERGARTEN", name: "Social Habits", category: "LEARNING_AREA" },
    { department: "KINDERGARTEN", name: "Our World Our People", category: "LEARNING_AREA" },
    { department: "PRIMARY", name: "English Language", category: "CORE" },
    { department: "PRIMARY", name: "Mathematics", category: "CORE" },
    { department: "PRIMARY", name: "Integrated Science", category: "CORE" },
    { department: "PRIMARY", name: "Our World Our People", category: "CORE" },
    { department: "PRIMARY", name: "Computing (ICT)", category: "ELECTIVE" },
    { department: "PRIMARY", name: "Religious & Moral Education", category: "ELECTIVE" },
    { department: "PRIMARY", name: "Ghanaian Language (Twi/Ga)", category: "ELECTIVE" },
    { department: "PRIMARY", name: "Creative Arts & Design", category: "ELECTIVE" },
    { department: "JHS", name: "English Language", category: "CORE" },
    { department: "JHS", name: "Mathematics", category: "CORE" },
    { department: "JHS", name: "Integrated Science", category: "CORE" },
    { department: "JHS", name: "Social Studies", category: "CORE" },
    { department: "JHS", name: "Computing (ICT)", category: "ELECTIVE" },
    { department: "JHS", name: "Religious & Moral Education", category: "ELECTIVE" },
    { department: "JHS", name: "Career Technology", category: "ELECTIVE" },
    { department: "JHS", name: "Creative Arts & Design", category: "ELECTIVE" },
    { department: "JHS", name: "Ghanaian Language (Twi/Ga)", category: "ELECTIVE" },
    { department: "JHS", name: "French", category: "ELECTIVE" },
  ];

  for (const ds of departmentSubjectsSeed) {
    await prisma.departmentSubject.upsert({
      where: { department_name: { department: ds.department, name: ds.name } },
      update: { category: ds.category },
      create: ds,
    });
  }

  // 5. All 14 Ghanaian Classes across 4 Departments
  const classSeed: Array<{
    name: string;
    department: "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";
    capacity: number;
    teacherId: string;
  }> = [
    { name: "Creche", department: "CRECHE", capacity: 20, teacherId: teacher4.id },
    { name: "Nursery 1", department: "CRECHE", capacity: 22, teacherId: teacher4.id },
    { name: "Nursery 2", department: "CRECHE", capacity: 22, teacherId: teacher4.id },
    { name: "KG 1", department: "KINDERGARTEN", capacity: 25, teacherId: teacher2.id },
    { name: "KG 2", department: "KINDERGARTEN", capacity: 25, teacherId: teacher2.id },
    { name: "Basic 1", department: "PRIMARY", capacity: 30, teacherId: teacher2.id },
    { name: "Basic 2", department: "PRIMARY", capacity: 30, teacherId: teacher3.id },
    { name: "Basic 3", department: "PRIMARY", capacity: 30, teacherId: teacher3.id },
    { name: "Basic 4", department: "PRIMARY", capacity: 30, teacherId: teacher1.id },
    { name: "Basic 5", department: "PRIMARY", capacity: 30, teacherId: teacher3.id },
    { name: "Basic 6", department: "PRIMARY", capacity: 30, teacherId: teacher2.id },
    { name: "JHS 1", department: "JHS", capacity: 32, teacherId: teacher1.id },
    { name: "JHS 2", department: "JHS", capacity: 32, teacherId: teacher1.id },
    { name: "JHS 3", department: "JHS", capacity: 32, teacherId: teacher3.id },
  ];

  const classMap: Record<string, { id: string; department: string }> = {};
  for (const c of classSeed) {
    const rec = await prisma.classroom.upsert({
      where: { name: c.name },
      update: { department: c.department, capacity: c.capacity, teacherId: c.teacherId },
      create: c,
    });
    classMap[c.name] = { id: rec.id, department: rec.department };
  }

  // 6. Students across all 4 departments
  // Parent 1 (Mr. Yaw Owusu-Ansah) has children in CRECHE (Maame Yaa), PRIMARY (Kofi), and JHS (Akosua & Kwabena)
  const studentsData = [
    {
      admissionNo: "SPS-2026-001",
      firstName: "Kofi",
      lastName: "Owusu-Ansah",
      gender: "MALE",
      dateOfBirth: "2016-04-12",
      nhisNumber: "NHIS-88291044",
      guardianName: "Mr. Yaw Owusu-Ansah",
      guardianPhone: "+233 24 900 4411",
      classroomId: classMap["Basic 4"].id,
      parentId: parent1.id,
    },
    {
      admissionNo: "SPS-2026-002",
      firstName: "Akosua",
      lastName: "Owusu-Ansah",
      gender: "FEMALE",
      dateOfBirth: "2013-09-23",
      nhisNumber: "NHIS-88291045",
      guardianName: "Mr. Yaw Owusu-Ansah",
      guardianPhone: "+233 24 900 4411",
      classroomId: classMap["JHS 1"].id,
      parentId: parent1.id,
    },
    {
      admissionNo: "SPS-2026-003",
      firstName: "Nana Kwesi",
      lastName: "Darko",
      gender: "MALE",
      dateOfBirth: "2016-11-05",
      nhisNumber: "NHIS-77410233",
      guardianName: "Mrs. Ama Darko",
      guardianPhone: "+233 55 310 7788",
      classroomId: classMap["Basic 4"].id,
      parentId: parent2.id,
    },
    {
      admissionNo: "SPS-2026-004",
      firstName: "Adwoa",
      lastName: "Darko",
      gender: "FEMALE",
      dateOfBirth: "2021-02-18",
      nhisNumber: "NHIS-77410234",
      guardianName: "Mrs. Ama Darko",
      guardianPhone: "+233 55 310 7788",
      classroomId: classMap["KG 1"].id,
      parentId: parent2.id,
    },
    {
      admissionNo: "SPS-2026-005",
      firstName: "Esi",
      lastName: "Mensah",
      gender: "FEMALE",
      dateOfBirth: "2014-07-30",
      nhisNumber: "NHIS-66102938",
      guardianName: "Mrs. Ama Darko",
      guardianPhone: "+233 55 310 7788",
      classroomId: classMap["Basic 6"].id,
      parentId: parent2.id,
    },
    {
      admissionNo: "SPS-2026-006",
      firstName: "Kwabena",
      lastName: "Appiah",
      gender: "MALE",
      dateOfBirth: "2012-03-14",
      nhisNumber: "NHIS-55019283",
      guardianName: "Mr. Yaw Owusu-Ansah",
      guardianPhone: "+233 24 900 4411",
      classroomId: classMap["JHS 2"].id,
      parentId: parent1.id,
    },
    {
      admissionNo: "SPS-2026-007",
      firstName: "Maame Yaa",
      lastName: "Owusu-Ansah",
      gender: "FEMALE",
      dateOfBirth: "2023-08-19",
      nhisNumber: "NHIS-44019211",
      guardianName: "Mr. Yaw Owusu-Ansah",
      guardianPhone: "+233 24 900 4411",
      classroomId: classMap["Creche"].id,
      parentId: parent1.id,
    },
    {
      admissionNo: "SPS-2026-008",
      firstName: "Nii",
      lastName: "Lartey",
      gender: "MALE",
      dateOfBirth: "2022-05-09",
      nhisNumber: "NHIS-44019212",
      guardianName: "Mrs. Beatrice Lartey",
      guardianPhone: "+233 24 331 8870",
      classroomId: classMap["Nursery 1"].id,
      parentId: null,
    },
    {
      admissionNo: "SPS-2026-009",
      firstName: "Yaa",
      lastName: "Agyeman",
      gender: "FEMALE",
      dateOfBirth: "2020-10-02",
      nhisNumber: "NHIS-33091822",
      guardianName: "Mr. Francis Agyeman",
      guardianPhone: "+233 54 102 6640",
      classroomId: classMap["KG 2"].id,
      parentId: null,
    },
  ];

  const students = [];
  for (const s of studentsData) {
    const record = await prisma.student.upsert({
      where: { admissionNo: s.admissionNo },
      update: {
        firstName: s.firstName,
        lastName: s.lastName,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        classroomId: s.classroomId,
        parentId: s.parentId,
      },
      create: s,
    });
    students.push(record);
  }

  // 7. Itemized Fee Structures
  const existingFees = await prisma.feeStructure.count({
    where: { termId: currentTerm.id },
  });
  if (existingFees === 0) {
    await prisma.feeStructure.createMany({
      data: [
        { title: "Creche Tuition & Daycare", category: "TUITION", amount: 1350, department: "CRECHE", termId: currentTerm.id },
        { title: "Creche Daily Feeding Fee", category: "FEEDING", amount: 450, department: "CRECHE", termId: currentTerm.id },
        { title: "Kindergarten Tuition Fee", category: "TUITION", amount: 1550, department: "KINDERGARTEN", termId: currentTerm.id },
        { title: "KG Feeding & Snack Levy", category: "FEEDING", amount: 380, department: "KINDERGARTEN", termId: currentTerm.id },
        { title: "KG Activity Books & Stationery", category: "BOOKS", amount: 220, department: "KINDERGARTEN", termId: currentTerm.id },
        { title: "Primary Tuition Fee", category: "TUITION", amount: 1800, department: "PRIMARY", termId: currentTerm.id },
        { title: "Primary Textbooks & Stationery", category: "BOOKS", amount: 250, department: "PRIMARY", termId: currentTerm.id },
        { title: "JHS Tuition & Science Lab", category: "TUITION", amount: 2200, department: "JHS", termId: currentTerm.id },
        { title: "JHS Textbooks & ICT Practicals", category: "BOOKS", amount: 300, department: "JHS", termId: currentTerm.id },
        { title: "PTA & Development Dues", category: "PTA", amount: 150, department: "ALL", termId: currentTerm.id },
      ],
    });
  }

  // 8. Fee Payments
  const paymentsData = [
    {
      receiptNo: "RCP-2026-1001",
      studentId: students[0].id,
      termId: currentTerm.id,
      amountPaid: 1500,
      paymentMethod: "MOMO",
      momoNetwork: "MTN",
      channel: "DESK",
      feeItemLabel: "Term 1 Tuition (Part Payment)",
      reference: "MTN-88492011",
      notes: "Part payment via MTN Mobile Money",
      recordedById: bursar.id,
    },
    {
      receiptNo: "RCP-2026-1002",
      studentId: students[1].id,
      termId: currentTerm.id,
      amountPaid: 2650,
      paymentMethod: "BANK_TRANSFER",
      momoNetwork: null,
      channel: "DESK",
      feeItemLabel: "Full Term 1 Bill Settlement (Tuition, Books & PTA)",
      reference: "GCB-20260912-44",
      notes: "Full Term 1 settlement via GCB Bank",
      recordedById: bursar.id,
    },
    {
      receiptNo: "RCP-2026-1003",
      studentId: students[2].id,
      termId: currentTerm.id,
      amountPaid: 2200,
      paymentMethod: "CASH",
      momoNetwork: null,
      channel: "DESK",
      feeItemLabel: "Full Term 1 Bill Settlement",
      reference: "CASH-DESK-09",
      notes: "Paid at Accounts Office",
      recordedById: bursar.id,
    },
    {
      receiptNo: "RCP-2026-1004",
      studentId: students[3].id,
      termId: currentTerm.id,
      amountPaid: 1200,
      paymentMethod: "MOMO",
      momoNetwork: "TELECEL",
      channel: "DESK",
      feeItemLabel: "KG 1 Tuition & Feeding (Part Payment)",
      reference: "TEL-5521009",
      notes: "Telecel Cash deposit",
      recordedById: bursar.id,
    },
  ];

  for (const p of paymentsData) {
    await prisma.feePayment.upsert({
      where: { receiptNo: p.receiptNo },
      update: { momoNetwork: p.momoNetwork, feeItemLabel: p.feeItemLabel, amountPaid: p.amountPaid },
      create: p,
    });
  }

  // 9. Attendance Records (today, yesterday, 2 days ago)
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgoDate = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  for (const s of students) {
    if (!s.classroomId) continue;
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: s.id, date: today } },
      update: {},
      create: {
        studentId: s.id,
        classroomId: s.classroomId,
        date: today,
        status:
          s.admissionNo === "SPS-2026-003"
            ? "LATE"
            : s.admissionNo === "SPS-2026-006"
            ? "ABSENT"
            : "PRESENT",
        remarks:
          s.admissionNo === "SPS-2026-003"
            ? "Arrived 7:45 AM (traffic)"
            : s.admissionNo === "SPS-2026-006"
            ? "Parent called in sick"
            : null,
        markedById: teacher1.id,
      },
    });
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: s.id, date: yesterdayDate } },
      update: {},
      create: {
        studentId: s.id,
        classroomId: s.classroomId,
        date: yesterdayDate,
        status: s.admissionNo === "SPS-2026-005" ? "ABSENT" : "PRESENT",
        remarks: s.admissionNo === "SPS-2026-005" ? "Hospital checkup note submitted" : null,
        markedById: teacher1.id,
      },
    });
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: s.id, date: twoDaysAgoDate } },
      update: {},
      create: {
        studentId: s.id,
        classroomId: s.classroomId,
        date: twoDaysAgoDate,
        status: s.admissionNo === "SPS-2026-001" ? "LATE" : "PRESENT",
        remarks: s.admissionNo === "SPS-2026-001" ? "Heavy morning rain" : null,
        markedById: teacher1.id,
      },
    });
  }

  // 10. Creche Daily Care Logs
  const maameYaa = students[6];
  const nii = students[7];
  if (maameYaa?.classroomId) {
    await prisma.crecheCareLog.upsert({
      where: { studentId_date: { studentId: maameYaa.id, date: today } },
      update: {},
      create: {
        studentId: maameYaa.id,
        classroomId: maameYaa.classroomId,
        date: today,
        breakfastStatus: "ATE_ALL",
        lunchStatus: "ATE_HALF",
        feedingNotes: "Enjoyed Hausa koko & bread; ate half portion of jollof rice.",
        napDuration: "1 hr 45 mins",
        sleepQuality: "PEACEFUL",
        diaperChecks: 3,
        pottyNotes: "2 wet diapers, 1 clean check. Skin dry & comfortable.",
        temperature: "36.6 °C",
        mood: "HAPPY",
        healthNotes: "Very playful during music and story circle.",
        pickupAuthorizedName: "Mr. Yaw Owusu-Ansah (Father)",
        pickupIdType: "Ghana Card",
        pickupIdNumber: "GHA-724819203-4",
        pickupTime: "15:20",
        pickupVerified: true,
        recordedById: teacher4.id,
      },
    });
  }
  if (nii?.classroomId) {
    await prisma.crecheCareLog.upsert({
      where: { studentId_date: { studentId: nii.id, date: today } },
      update: {},
      create: {
        studentId: nii.id,
        classroomId: nii.classroomId,
        date: today,
        breakfastStatus: "ATE_HALF",
        lunchStatus: "ATE_ALL",
        feedingNotes: "Needed gentle encouragement at breakfast, finished all lunch.",
        napDuration: "1 hr 15 mins",
        sleepQuality: "LIGHT",
        diaperChecks: 3,
        pottyNotes: "Used potty twice successfully; 1 wet diaper.",
        temperature: "36.7 °C",
        mood: "CALM",
        healthNotes: "Calm and cooperative all morning.",
        pickupAuthorizedName: "Mrs. Beatrice Lartey (Mother)",
        pickupIdType: "Ghana Card",
        pickupIdNumber: "GHA-619283741-9",
        pickupTime: null,
        pickupVerified: false,
        recordedById: teacher4.id,
      },
    });
  }

  // 11. Assessments (Primary, JHS BECE, KG Mastery)
  const primaryScores = [
    { studentId: students[0].id, subject: "English Language", category: "CORE", classScore: 41, examScore: 39 },
    { studentId: students[0].id, subject: "Mathematics", category: "CORE", classScore: 44, examScore: 42 },
    { studentId: students[0].id, subject: "Integrated Science", category: "CORE", classScore: 42, examScore: 43 },
    { studentId: students[0].id, subject: "Our World Our People", category: "CORE", classScore: 38, examScore: 37 },
    { studentId: students[0].id, subject: "Computing (ICT)", category: "ELECTIVE", classScore: 45, examScore: 44 },
    { studentId: students[2].id, subject: "English Language", category: "CORE", classScore: 40, examScore: 38 },
    { studentId: students[2].id, subject: "Mathematics", category: "CORE", classScore: 35, examScore: 34 },
    { studentId: students[2].id, subject: "Integrated Science", category: "CORE", classScore: 37, examScore: 36 },
    { studentId: students[2].id, subject: "Our World Our People", category: "CORE", classScore: 41, examScore: 40 },
    { studentId: students[2].id, subject: "Computing (ICT)", category: "ELECTIVE", classScore: 39, examScore: 38 },
  ];

  for (const a of primaryScores) {
    const total = a.classScore + a.examScore;
    const { grade, remarks } = primaryLetterGrade(total);
    await prisma.assessment.upsert({
      where: { studentId_termId_subject: { studentId: a.studentId, termId: currentTerm.id, subject: a.subject } },
      update: { subjectCategory: a.category, classScore: a.classScore, examScore: a.examScore, totalScore: total, grade, remarks },
      create: { studentId: a.studentId, termId: currentTerm.id, subject: a.subject, subjectCategory: a.category, classScore: a.classScore, examScore: a.examScore, totalScore: total, grade, remarks, recordedById: teacher1.id },
    });
  }

  const jhsScores = [
    { studentId: students[1].id, subject: "English Language", category: "CORE", classScore: 43, examScore: 40 },
    { studentId: students[1].id, subject: "Mathematics", category: "CORE", classScore: 46, examScore: 45 },
    { studentId: students[1].id, subject: "Integrated Science", category: "CORE", classScore: 40, examScore: 38 },
    { studentId: students[1].id, subject: "Social Studies", category: "CORE", classScore: 39, examScore: 37 },
    { studentId: students[1].id, subject: "Computing (ICT)", category: "ELECTIVE", classScore: 48, examScore: 44 },
    { studentId: students[1].id, subject: "Religious & Moral Education", category: "ELECTIVE", classScore: 42, examScore: 41 },
    { studentId: students[1].id, subject: "Career Technology", category: "ELECTIVE", classScore: 36, examScore: 35 },
    { studentId: students[5].id, subject: "English Language", category: "CORE", classScore: 38, examScore: 34 },
    { studentId: students[5].id, subject: "Mathematics", category: "CORE", classScore: 36, examScore: 32 },
    { studentId: students[5].id, subject: "Integrated Science", category: "CORE", classScore: 39, examScore: 36 },
    { studentId: students[5].id, subject: "Social Studies", category: "CORE", classScore: 42, examScore: 40 },
    { studentId: students[5].id, subject: "Computing (ICT)", category: "ELECTIVE", classScore: 41, examScore: 39 },
    { studentId: students[5].id, subject: "Religious & Moral Education", category: "ELECTIVE", classScore: 37, examScore: 35 },
    { studentId: students[5].id, subject: "French", category: "ELECTIVE", classScore: 33, examScore: 31 },
  ];

  for (const a of jhsScores) {
    const total = a.classScore + a.examScore;
    const { grade, remarks } = computeBece(total);
    await prisma.assessment.upsert({
      where: { studentId_termId_subject: { studentId: a.studentId, termId: currentTerm.id, subject: a.subject } },
      update: { subjectCategory: a.category, classScore: a.classScore, examScore: a.examScore, totalScore: total, grade, remarks },
      create: { studentId: a.studentId, termId: currentTerm.id, subject: a.subject, subjectCategory: a.category, classScore: a.classScore, examScore: a.examScore, totalScore: total, grade, remarks, recordedById: teacher1.id },
    });
  }

  const ratingLabels: Record<string, string> = {
    EXCEEDING: "Exceeding Expectation",
    MEETING: "Meeting Expectation",
    DEVELOPING: "Developing",
    NEEDS_SUPPORT: "Needs Support",
  };
  const kgMasterySeed = [
    { studentId: students[3].id, subject: "Phonics & Early Literacy", rating: "EXCEEDING", remarks: "Blends letter sounds confidently and reads simple CVC words." },
    { studentId: students[3].id, subject: "Numeracy", rating: "MEETING", remarks: "Counts accurately up to 50 and recognizes basic shapes." },
    { studentId: students[3].id, subject: "Creative Arts", rating: "EXCEEDING", remarks: "Very expressive in drawing, colouring, and craft activities." },
    { studentId: students[3].id, subject: "Social Habits", rating: "MEETING", remarks: "Shares kindly with classmates and follows routines well." },
    { studentId: students[8].id, subject: "Phonics & Early Literacy", rating: "MEETING", remarks: "Reads short sentences with steady guidance." },
    { studentId: students[8].id, subject: "Numeracy", rating: "DEVELOPING", remarks: "Making steady progress with simple addition facts." },
  ];

  for (const k of kgMasterySeed) {
    await prisma.assessment.upsert({
      where: { studentId_termId_subject: { studentId: k.studentId, termId: currentTerm.id, subject: k.subject } },
      update: { subjectCategory: "LEARNING_AREA", masteryRating: k.rating, grade: ratingLabels[k.rating], remarks: k.remarks },
      create: { studentId: k.studentId, termId: currentTerm.id, subject: k.subject, subjectCategory: "LEARNING_AREA", classScore: 0, examScore: 0, totalScore: 0, grade: ratingLabels[k.rating], masteryRating: k.rating, remarks: k.remarks, recordedById: teacher2.id },
    });
  }

  // 12. Terminal Report Cards
  await prisma.termReportCard.upsert({
    where: { studentId_termId: { studentId: students[1].id, termId: currentTerm.id } },
    update: {},
    create: {
      studentId: students[1].id,
      termId: currentTerm.id,
      teacherRemarks: "Akosua is an outstanding JHS scholar with remarkable discipline in Mathematics and ICT. Keep soaring!",
      conduct: "Exemplary & Respectful",
      interest: "Robotics, Debate & Reading",
      headmasterRemarks: "Excellent terminal performance. Approved for honour roll recognition.",
      status: "PUBLISHED",
      approvedById: headmaster.id,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });
  await prisma.termReportCard.upsert({
    where: { studentId_termId: { studentId: students[0].id, termId: currentTerm.id } },
    update: {},
    create: {
      studentId: students[0].id,
      termId: currentTerm.id,
      teacherRemarks: "Kofi demonstrates strong curiosity in Science and Mathematics. Consistent class participation.",
      conduct: "Polite & Cooperative",
      interest: "Football & Science Experiments",
      headmasterRemarks: "Very impressive term's work. Keep up the high standard.",
      status: "PUBLISHED",
      approvedById: headmaster.id,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });
  await prisma.termReportCard.upsert({
    where: { studentId_termId: { studentId: students[2].id, termId: currentTerm.id } },
    update: {},
    create: {
      studentId: students[2].id,
      termId: currentTerm.id,
      teacherRemarks: "Nana Kwesi is diligent and participates warmly. Extra practice in Mathematics word problems will boost his score.",
      conduct: "Respectful",
      interest: "Drawing & Athletics",
      status: "PENDING_APPROVAL",
    },
  });
  await prisma.termReportCard.upsert({
    where: { studentId_termId: { studentId: students[3].id, termId: currentTerm.id } },
    update: {},
    create: {
      studentId: students[3].id,
      termId: currentTerm.id,
      teacherRemarks: "Adwoa is a joyful learner who loves phonics songs, storybooks, and group art projects.",
      conduct: "Cheerful & Friendly",
      interest: "Storytelling, Singing & Colouring",
      headmasterRemarks: "Wonderful developmental progress in KG 1.",
      status: "PUBLISHED",
      approvedById: headmaster.id,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  // 13. Department-Targeted School Announcements
  const existingAnnouncements = await prisma.announcement.count();
  if (existingAnnouncements === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: "Term 1 Mid-Term Open Day & PTA General Meeting",
          content:
            "Dear Parents and Guardians, our Term 1 Open Day and PTA General Meeting takes place this Friday at 9:00 AM at the School Assembly Hall. Please attend to review your ward's academic progress.",
          audience: "ALL",
          targetDepartment: "ALL",
          pinned: true,
          authorId: headmaster.id,
        },
        {
          title: "JHS BECE Mock Examination Timetable Released",
          content:
            "All JHS 1–3 parents and students should note that BECE Mock Examinations begin next Monday at 8:00 AM sharp. Mathematical sets and approved calculators are required.",
          audience: "PARENTS",
          targetDepartment: "JHS",
          pinned: false,
          authorId: headmaster.id,
        },
        {
          title: "Creche Nutrition & Afternoon Pickup Tag Reminder",
          content:
            "Please bring your official School Pickup Tag or Ghana Card during afternoon collection at the Creche Wing. Updated toddler meal menus are available at reception.",
          audience: "PARENTS",
          targetDepartment: "CRECHE",
          pinned: false,
          authorId: headmaster.id,
        },
        {
          title: "Submission of SBA Continuous Assessment Sheets",
          content:
            "All class teachers must upload Term 1 Class Scores and Terminal Remarks in the Grading portal by Thursday 4:00 PM for Headmaster approval.",
          audience: "TEACHERS",
          targetDepartment: "ALL",
          pinned: false,
          authorId: headmaster.id,
        },
      ],
    });
  }

  // 14. Seed Sample SMS Outbox Logs
  const existingSms = await prisma.smsLog.count();
  if (existingSms === 0) {
    await prisma.smsLog.createMany({
      data: [
        {
          recipientName: "Mr. Yaw Owusu-Ansah",
          recipientPhone: "+233 24 900 4411",
          message:
            "Sankofa Preparatory & JHS: Receipt RCP-2026-1002 confirmed for Akosua Owusu-Ansah. Amount Paid: GH₵ 2,650.00. Remaining Balance: GH₵ 0.00. Thank you!",
          eventType: "FEE_RECEIPT",
          provider: "SIMULATION",
          status: "SIMULATED",
          providerRef: "SIM-SMS-SEED-001",
          sentById: bursar.id,
        },
        {
          recipientName: "Mr. Yaw Owusu-Ansah",
          recipientPhone: "+233 24 900 4411",
          message:
            "Sankofa Preparatory & JHS Attendance Alert: Kwabena Appiah (JHS 2) was marked ABSENT today. Please contact the school office if unaware.",
          eventType: "ABSENCE_ALERT",
          provider: "SIMULATION",
          status: "SIMULATED",
          providerRef: "SIM-SMS-SEED-002",
          sentById: teacher1.id,
        },
        {
          recipientName: "Mr. Yaw Owusu-Ansah",
          recipientPhone: "+233 24 900 4411",
          message:
            "Sankofa Preparatory & JHS: Term 1 Terminal Report Card for Akosua Owusu-Ansah (JHS 1) has been approved by the Headmaster and is ready to download in your Parent Portal.",
          eventType: "REPORT_PUBLISHED",
          provider: "SIMULATION",
          status: "SIMULATED",
          providerRef: "SIM-SMS-SEED-003",
          sentById: headmaster.id,
        },
      ],
    });
  }

  return {
    departments: 4,
    classes: classSeed.length,
    teachers: 4,
    students: students.length,
  };
}
