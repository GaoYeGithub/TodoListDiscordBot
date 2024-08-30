const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

const commands = [
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new todo item')
    .addStringOption(option => option.setName('item').setDescription('The todo item to add').setRequired(true))
    .addStringOption(option => option.setName('due_date').setDescription('Due date (YYYY-MM-DD)'))
    .addStringOption(option => option.setName('priority').setDescription('Priority level').addChoices(
      { name: 'High', value: 'high' },
      { name: 'Medium', value: 'medium' },
      { name: 'Low', value: 'low' }
    ))
    .addStringOption(option => option.setName('recurrence').setDescription('Recurrence pattern (daily, weekly, monthly)'))
    .addStringOption(option => option.setName('category').setDescription('Category or tag for the task')),
  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all todo items'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a todo item')
    .addIntegerOption(option => option.setName('index').setDescription('The index of the item to remove').setRequired(true)),
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for todo items')
    .addStringOption(option => option.setName('keyword').setDescription('Keyword to search for').setRequired(true)),
  new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update a todo item')
    .addIntegerOption(option => option.setName('index').setDescription('The index of the item to update').setRequired(true))
    .addStringOption(option => option.setName('item').setDescription('New todo item text'))
    .addStringOption(option => option.setName('due_date').setDescription('New due date (YYYY-MM-DD)'))
    .addStringOption(option => option.setName('priority').setDescription('New priority level').addChoices(
      { name: 'High', value: 'high' },
      { name: 'Medium', value: 'medium' },
      { name: 'Low', value: 'low' }
    ))
    .addStringOption(option => option.setName('recurrence').setDescription('New recurrence pattern (daily, weekly, monthly)'))
    .addStringOption(option => option.setName('category').setDescription('New category or tag for the task'))
];

const TODO_FILE = 'todo.yaml';

function loadTodos() {
  try {
    return yaml.load(fs.readFileSync(TODO_FILE, 'utf8')) || [];
  } catch (e) {
    console.log('No existing todo file found. Starting with an empty list.');
    return [];
  }
}

function saveTodos(todos) {
  fs.writeFileSync(TODO_FILE, yaml.dump(todos));
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    console.log('Started refreshing application (/) commands.');
    await client.application.commands.set(commands);
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application (/) commands:', error);
  }

  cron.schedule('* * * * *', () => {
    checkRecurringTasks();
  });

  cron.schedule('* * * * *', () => {
    checkReminders();
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'add') {
      await handleAddCommand(interaction);
    } else if (commandName === 'list') {
      await handleListCommand(interaction);
    } else if (commandName === 'remove') {
      await handleRemoveCommand(interaction);
    } else if (commandName === 'search') {
      await handleSearchCommand(interaction);
    } else if (commandName === 'update') {
      await handleUpdateCommand(interaction);
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply('An error occurred while processing your command. Please try again later.');
  }
});

async function handleAddCommand(interaction) {
    const item = interaction.options.getString('item');
    const dueDate = interaction.options.getString('due_date');
    const priority = interaction.options.getString('priority');
    const recurrence = interaction.options.getString('recurrence');
    const category = interaction.options.getString('category');
  
    const newTodo = {
      item,
      dueDate,
      priority,
      recurrence,
      category,
      createdAt: new Date().toISOString(),
      userId: interaction.user.id
    };
  
    const todos = loadTodos();
    todos.push(newTodo);
    saveTodos(todos);
  
    await interaction.reply(`Added todo item: ${item}`);
  }

async function handleListCommand(interaction) {
  const todos = loadTodos();
  if (todos.length === 0) {
    await interaction.reply('Your todo list is empty.');
  } else {
    const todoList = todos.map((todo, index) => {
      let item = `${index + 1}. ${todo.item}`;
      if (todo.dueDate) item += ` (Due: ${todo.dueDate})`;
      if (todo.priority) item += ` [${todo.priority}]`;
      if (todo.category) item += ` #${todo.category}`;
      return item;
    }).join('\n');
    await interaction.reply(`Your todo list:\n${todoList}`);
  }
}

async function handleRemoveCommand(interaction) {
  const index = interaction.options.getInteger('index') - 1;
  const todos = loadTodos();
  if (index < 0 || index >= todos.length) {
    await interaction.reply('Invalid index. Please provide a valid todo item number.');
  } else {
    const removedItem = todos.splice(index, 1)[0];
    saveTodos(todos);
    await interaction.reply(`Removed todo item: ${removedItem.item}`);
  }
}

async function handleSearchCommand(interaction) {
  const keyword = interaction.options.getString('keyword').toLowerCase();
  const todos = loadTodos();
  const matchingTodos = todos.filter(todo => 
    todo.item.toLowerCase().includes(keyword) ||
    (todo.category && todo.category.toLowerCase().includes(keyword))
  );

  if (matchingTodos.length === 0) {
    await interaction.reply('No matching todo items found.');
  } else {
    const todoList = matchingTodos.map((todo, index) => {
      let item = `${index + 1}. ${todo.item}`;
      if (todo.dueDate) item += ` (Due: ${todo.dueDate})`;
      if (todo.priority) item += ` [${todo.priority}]`;
      if (todo.category) item += ` #${todo.category}`;
      return item;
    }).join('\n');
    await interaction.reply(`Matching todo items:\n${todoList}`);
  }
}

async function handleUpdateCommand(interaction) {
  const index = interaction.options.getInteger('index') - 1;
  const todos = loadTodos();
  if (index < 0 || index >= todos.length) {
    await interaction.reply('Invalid index. Please provide a valid todo item number.');
    return;
  }

  const updatedTodo = { ...todos[index] };
  const newItem = interaction.options.getString('item');
  const newDueDate = interaction.options.getString('due_date');
  const newPriority = interaction.options.getString('priority');
  const newRecurrence = interaction.options.getString('recurrence');
  const newCategory = interaction.options.getString('category');

  if (newItem) updatedTodo.item = newItem;
  if (newDueDate) updatedTodo.dueDate = newDueDate;
  if (newPriority) updatedTodo.priority = newPriority;
  if (newRecurrence) updatedTodo.recurrence = newRecurrence;
  if (newCategory) updatedTodo.category = newCategory;

  todos[index] = updatedTodo;
  saveTodos(todos);

  await interaction.reply(`Updated todo item: ${updatedTodo.item}`);
}

function checkRecurringTasks() {
  const todos = loadTodos();
  const today = new Date().toISOString().split('T')[0];
  
  todos.forEach(todo => {
    if (todo.recurrence && todo.dueDate === today) {
      const newTodo = { ...todo };
      if (todo.recurrence === 'daily') {
        newTodo.dueDate = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (todo.recurrence === 'weekly') {
        newTodo.dueDate = new Date(new Date(today).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (todo.recurrence === 'monthly') {
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        newTodo.dueDate = nextMonth.toISOString().split('T')[0];
      }
      todos.push(newTodo);
    }
  });

  saveTodos(todos);
}

async function checkReminders() {
    const todos = loadTodos();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    for (const todo of todos) {
      if (todo.dueDate && todo.userId) {
        const dueDate = new Date(todo.dueDate);
        if (dueDate.toDateString() === tomorrow.toDateString()) {
          try {
            const user = await client.users.fetch(todo.userId);
            await user.send(`Reminder: Your task "${todo.item}" is due tomorrow!`);
            console.log(`Sent reminder to user ${todo.userId} for task "${todo.item}"`);
          } catch (error) {
            console.error(`Failed to send reminder to user ${todo.userId}:`, error);
          }
        }
    }
  }
}


process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.BOT_TOKEN);