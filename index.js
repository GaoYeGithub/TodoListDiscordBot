const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new todo item')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('The todo item to add')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all todo items'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a todo item')
    .addIntegerOption(option =>
      option.setName('index')
        .setDescription('The index of the item to remove')
        .setRequired(true))
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
});

client.on('interactionCreate', async interaction => {
  console.log(`Received interaction: ${interaction.commandName}`);
  
  if (!interaction.isCommand()) {
    console.log('Interaction is not a command');
    return;
  }

  const { commandName } = interaction;

  try {
    if (commandName === 'add') {
      const item = interaction.options.getString('item');
      console.log(`Adding item: ${item}`);
      const todos = loadTodos();
      todos.push(item);
      saveTodos(todos);
      await interaction.reply(`Added todo item: ${item}`);
    } else if (commandName === 'list') {
      console.log('Listing items');
      const todos = loadTodos();
      if (todos.length === 0) {
        await interaction.reply('Your todo list is empty.');
      } else {
        const todoList = todos.map((item, index) => `${index + 1}. ${item}`).join('\n');
        await interaction.reply(`Your todo list:\n${todoList}`);
      }
    } else if (commandName === 'remove') {
      const index = interaction.options.getInteger('index') - 1;
      console.log(`Removing item at index: ${index}`);
      const todos = loadTodos();
      if (index < 0 || index >= todos.length) {
        await interaction.reply('Invalid index. Please provide a valid todo item number.');
      } else {
        const removedItem = todos.splice(index, 1)[0];
        saveTodos(todos);
        await interaction.reply(`Removed todo item: ${removedItem}`);
      }
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply('An error occurred while processing your command. Please try again later.');
  }
});

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

client.login(process.env.BOT_TOKEN);