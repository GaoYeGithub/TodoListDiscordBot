const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const PocketBase = require('pocketbase/cjs');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });
const pb = new PocketBase('http://127.0.0.1:8090/');

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
  
    try {
      await pb.collection('todos').create(newTodo);
      await interaction.reply(`Added todo item: ${item}`);
    } catch (error) {
      console.error('Error adding todo item:', error);
      await interaction.reply('Failed to add todo item. Please try again.');
    }
  }

async function handleListCommand(interaction) {
  try {
    const records = await pb.collection('todos').getFullList({
      sort: '-created',
    });

    if (records.length === 0) {
      await interaction.reply('Your todo list is empty.');
    } else {
      const todoList = records.map((todo, index) => {
        let item = `${index + 1}. ${todo.item}`;
        if (todo.dueDate) item += ` (Due: ${todo.dueDate})`;
        if (todo.priority) item += ` [${todo.priority}]`;
        if (todo.category) item += ` #${todo.category}`;
        return item;
      }).join('\n');
      await interaction.reply(`Your todo list:\n${todoList}`);
    }
  } catch (error) {
    console.error('Error listing todos:', error);
    await interaction.reply('Failed to list todo items. Please try again.');
  }
}

async function handleRemoveCommand(interaction) {
  const index = interaction.options.getInteger('index') - 1;
  
  try {
    const records = await pb.collection('todos').getFullList({
      sort: '-created',
    });

    if (index < 0 || index >= records.length) {
      await interaction.reply('Invalid index. Please provide a valid todo item number.');
    } else {
      const removedItem = records[index];
      await pb.collection('todos').delete(removedItem.id);
      await interaction.reply(`Removed todo item: ${removedItem.item}`);
    }
  } catch (error) {
    console.error('Error removing todo item:', error);
    await interaction.reply('Failed to remove todo item. Please try again.');
  }
}

async function handleSearchCommand(interaction) {
  const keyword = interaction.options.getString('keyword').toLowerCase();

  try {
    const records = await pb.collection('todos').getFullList({
      filter: `item ~ "${keyword}" || category ~ "${keyword}"`,
    });

    if (records.length === 0) {
      await interaction.reply('No matching todo items found.');
    } else {
      const todoList = records.map((todo, index) => {
        let item = `${index + 1}. ${todo.item}`;
        if (todo.dueDate) item += ` (Due: ${todo.dueDate})`;
        if (todo.priority) item += ` [${todo.priority}]`;
        if (todo.category) item += ` #${todo.category}`;
        return item;
      }).join('\n');
      await interaction.reply(`Matching todo items:\n${todoList}`);
    }
  } catch (error) {
    console.error('Error searching todos:', error);
    await interaction.reply('Failed to search todo items. Please try again.');
  }
}

async function handleUpdateCommand(interaction) {
  const index = interaction.options.getInteger('index') - 1;

  try {
    const records = await pb.collection('todos').getFullList({
      sort: '-created',
    });

    if (index < 0 || index >= records.length) {
      await interaction.reply('Invalid index. Please provide a valid todo item number.');
      return;
    }

    const todoToUpdate = records[index];
    const updateData = {};

    const newItem = interaction.options.getString('item');
    const newDueDate = interaction.options.getString('due_date');
    const newPriority = interaction.options.getString('priority');
    const newRecurrence = interaction.options.getString('recurrence');
    const newCategory = interaction.options.getString('category');

    if (newItem) updateData.item = newItem;
    if (newDueDate) updateData.dueDate = newDueDate;
    if (newPriority) updateData.priority = newPriority;
    if (newRecurrence) updateData.recurrence = newRecurrence;
    if (newCategory) updateData.category = newCategory;

    await pb.collection('todos').update(todoToUpdate.id, updateData);
    await interaction.reply(`Updated todo item: ${updateData.item || todoToUpdate.item}`);
  } catch (error) {
    console.error('Error updating todo item:', error);
    await interaction.reply('Failed to update todo item. Please try again.');
  }
}

async function checkRecurringTasks() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const records = await pb.collection('todos').getFullList({
      filter: `recurrence != "" && dueDate = "${today}"`,
    });

    for (const todo of records) {
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
      await pb.collection('todos').create(newTodo);
    }
  } catch (error) {
    console.error('Error checking recurring tasks:', error);
  }
}

async function checkReminders() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  try {
    const records = await pb.collection('todos').getFullList({
      filter: `dueDate = "${tomorrowDate}"`,
    });

    for (const todo of records) {
      if (todo.userId) {
        try {
          const user = await client.users.fetch(todo.userId);
          await user.send(`Reminder: Your task "${todo.item}" is due tomorrow!`);
          console.log(`Sent reminder to user ${todo.userId} for task "${todo.item}"`);
        } catch (error) {
          console.error(`Failed to send reminder to user ${todo.userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}


process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.BOT_TOKEN);