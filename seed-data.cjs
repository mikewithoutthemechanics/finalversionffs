// Test Data Seeding Script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const sports = ['Running', 'Yoga', 'Cycling', 'Swimming', 'CrossFit', 'Tennis', 'Golf', 'Soccer', 'Basketball', 'General'];
const bodyAreas = ['hips', 'shoulders', 'spine', 'neck', 'lower_back', 'knees', 'ankles', 'wrists', 'full_body'];
const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Peyton', 'Dakota', 'Skyler', 'Reese', 'Rowan', 'Emerson', 'Finley'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];

function generateId() {
  return `seed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateEmail(firstName, lastName) {
  const domains = ['test.com', 'example.com', 'staging.local'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
}

function generatePhone() {
  return `+27${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function seedVenues() {
  console.log('\n📍 Seeding venues...');
  const venues = [
    { id: 'venue_1', name: 'Pause Studio - Rosebank', address: 'Craddock Ave, Rosebank', suburb: 'Rosebank', active: true },
    { id: 'venue_2', name: 'Pause Dome - Sandton', address: 'Rivonia Road, Sandton', suburb: 'Sandton', active: true },
    { id: 'venue_3', name: 'Pause Studio - Fourways', address: 'William Nicol Drive, Fourways', suburb: 'Fourways', active: true },
  ];

  let count = 0;
  for (const venue of venues) {
    const { error } = await supabase.from('venues').upsert(venue);
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} venues`);
  return venues.map(v => v.id);
}

async function seedInstructors() {
  console.log('\n👨‍🏫 Seeding instructors...');
  const instructors = [
    { id: 'instructor_1', name: 'Sarah Johnson', email: 'sarah.j@test.com', specialties: ['Yoga', 'General'], bio: 'Certified yoga instructor', active: true },
    { id: 'instructor_2', name: 'Mike Peters', email: 'mike.p@test.com', specialties: ['CrossFit', 'Running'], bio: 'Sports recovery specialist', active: true },
    { id: 'instructor_3', name: 'Emma Williams', email: 'emma.w@test.com', specialties: ['General', 'Cycling'], bio: 'Fascia movement specialist', active: true },
    { id: 'instructor_4', name: 'David Chen', email: 'david.c@test.com', specialties: ['Swimming', 'Tennis'], bio: 'Sports therapist', active: true },
  ];

  let count = 0;
  for (const instructor of instructors) {
    const { error } = await supabase.from('instructors').upsert(instructor);
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} instructors`);
  return instructors.map(i => i.id);
}

async function seedUsers() {
  console.log('\n👥 Seeding users...');
  
  // Create admin user
  await supabase.from('users').upsert({
    id: 'admin_001',
    name: 'Admin User',
    email: 'admin@test.com',
    is_admin: true,
    admin_role: 'super_admin',
    credits: 100,
    waiver_accepted: true,
    medical_cleared: true,
    heat_acknowledged: true,
  });

  // Create regular users
  let count = 1;
  for (let i = 0; i < 19; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const { error } = await supabase.from('users').upsert({
      id: `user_${i + 1}`,
      name: `${firstName} ${lastName}`,
      email: generateEmail(firstName, lastName),
      phone: generatePhone(),
      is_admin: false,
      sport: randomItem(sports),
      credits: Math.floor(Math.random() * 20),
      waiver_accepted: Math.random() > 0.3,
      medical_cleared: Math.random() > 0.2,
      heat_acknowledged: Math.random() > 0.2,
    });
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} users`);
  return Array.from({length: count}, (_, i) => `user_${i + 1}`);
}

async function seedClasses(venueIds, instructorIds) {
  console.log('\n📅 Seeding classes...');
  const classTitles = [
    'Morning Dome Session', 'Evening Wind Down', 'Athletic Recovery', 'Deep Tissue Release',
    'Weekend Warrior Reset', 'Lunch Break Flow', 'Post-Work Recovery', 'Weekend Intensive',
    'Beginner Basics', 'Advanced Techniques', 'Sport Specific - Runners', 'Sport Specific - Cyclists',
    'Hip Focus Session', 'Shoulder Release', 'Full Body Reset'
  ];

  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let count = 0;
  for (let i = 0; i < 15; i++) {
    const dateTime = randomDate(i < 5 ? past : now, i < 5 ? now : future);
    const isDome = i % 3 === 0;
    
    const { error } = await supabase.from('classes').upsert({
      id: `class_${i + 1}`,
      slug: `class-${i + 1}`,
      title: classTitles[i % classTitles.length],
      date_time: dateTime,
      duration: isDome ? 75 : 60,
      venue_id: randomItem(venueIds),
      instructor_id: randomItem(instructorIds),
      sport_tags: randomItems(sports, 2),
      body_area_tags: randomItems(bodyAreas, 2),
      capacity: isDome ? 15 : 20,
      registered: 0,
      status: i < 2 ? 'cancelled' : i < 5 ? 'draft' : 'published',
      description: `A ${isDome ? 'heated dome' : 'studio'} session focused on fascial release.`,
      price: i % 4 === 0 ? 250 : 0,
      credit_cost: i % 4 === 0 ? 2 : 1,
    });
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} classes`);
  return Array.from({length: count}, (_, i) => `class_${i + 1}`);
}

async function seedRegistrations(userIds, classIds) {
  console.log('\n📝 Seeding registrations...');
  const regularUsers = userIds.slice(1);
  const statuses = ['confirmed', 'registered', 'cancelled', 'waitlisted', 'payment_review'];
  
  let count = 0;
  for (let i = 0; i < 50; i++) {
    const userId = randomItem(regularUsers);
    const user = await supabase.from('users').select('name, email, sport').eq('id', userId).single();
    const classId = randomItem(classIds);
    const status = randomItem(statuses);
    const isPaid = status === 'confirmed' || status === 'payment_review';

    const { error } = await supabase.from('registrations').upsert({
      id: `reg_${i + 1}`,
      class_id: classId,
      user_id: userId,
      user_name: user.data?.name || 'Unknown',
      user_email: user.data?.email,
      user_sport: user.data?.sport || 'General',
      body_areas: randomItems(bodyAreas, 2),
      status,
      payment_status: isPaid ? 'paid' : 'pending',
      payment_method: isPaid ? randomItem(['zapper', 'manual']) : null,
      registered_at: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
    });
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} registrations`);
}

async function seedTemplates() {
  console.log('\n📄 Seeding templates...');
  const templates = [
    { id: 'template_1', name: 'Welcome Message', active: true },
    { id: 'template_2', name: 'Waitlist Notification', active: true },
    { id: 'template_3', name: 'Class Reminder', active: true },
  ];

  let count = 0;
  for (const template of templates) {
    const { error } = await supabase.from('templates').upsert({
      ...template,
      sport_tags: randomItems(sports, 2),
      body_area_tags: randomItems(bodyAreas, 2),
      whatsapp_body: `Hi {{name}}! ${template.name}`,
      email_subject: template.name,
      email_body: `Dear {{name}},\n\n${template.name}`,
    });
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} templates`);
}

async function seedFeedback(userIds, classIds) {
  console.log('\n⭐ Seeding feedback...');
  const regularUsers = userIds.slice(1);
  const types = ['post_class', 'general', 'nps'];
  
  let count = 0;
  for (let i = 0; i < 30; i++) {
    const userId = randomItem(regularUsers);
    const user = await supabase.from('users').select('name').eq('id', userId).single();
    const type = randomItem(types);

    const { error } = await supabase.from('feedback').upsert({
      id: `feedback_${i + 1}`,
      class_id: type === 'post_class' ? randomItem(classIds) : null,
      user_id: userId,
      user_name: user.data?.name || 'Anonymous',
      type,
      rating: type !== 'nps' ? Math.floor(Math.random() * 5) + 1 : null,
      nps_score: type === 'nps' ? Math.floor(Math.random() * 11) : null,
      comment: Math.random() > 0.5 ? 'Great session! Really helped with my flexibility.' : null,
    });
    if (!error) count++;
  }
  console.log(`   ✓ Created ${count} feedback entries`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              Test Data Seeding Script                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${supabaseUrl}`);
  console.log('\n⚠️  Seeding test data...\n');

  const startTime = Date.now();

  try {
    const venueIds = await seedVenues();
    const instructorIds = await seedInstructors();
    const userIds = await seedUsers();
    const classIds = await seedClasses(venueIds, instructorIds);

    await seedRegistrations(userIds, classIds);
    await seedTemplates();
    await seedFeedback(userIds, classIds);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                  SEEDING COMPLETE                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log('\n🎉 Test data seeded successfully!');
    console.log('\nCreated:');
    console.log('   • 3 venues');
    console.log('   • 4 instructors');
    console.log('   • 20 users (1 admin + 19 regular)');
    console.log('   • 15 classes');
    console.log('   • 50 registrations');
    console.log('   • 3 templates');
    console.log('   • 30 feedback entries');
    console.log('\nTest Account: admin@test.com\n');

  } catch (err) {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  }
}

main();
