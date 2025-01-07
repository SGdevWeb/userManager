const express = require("express");
const { NodeSSH } = require("node-ssh");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

const getGroupsWithHighGID = async (ssh) => {
  const groupsResult = await ssh.execCommand(
    "grep -E ':[0-9]{4,}:' /etc/group"
  );
  return groupsResult.stdout.split("\n").filter((group) => group.trim() !== "");
};

const getGroupsWithUsers = async (ssh) => {
  const groupsResult = await ssh.execCommand("awk -F: '$4 != \"\"' /etc/group");
  return groupsResult.stdout.split("\n").filter((group) => group.trim() !== "");
};

const mergeAndRemoveDuplicates = (groups1, groups2) => {
  const uniqueGroups = new Set([...groups1, ...groups2]);
  return Array.from(uniqueGroups);
};

// Endpoint pour récupérer la liste des serveurs
app.get("/servers", (req, res) => {
  // Liste des serveurs
  const servers = fs
    .readFileSync("servers.txt", "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name, ip, username, port] = line.split(":");
      return { name, ip, username, port };
    });
  res.json(servers);
});

// Endpoint pour ajouter un serveur
app.post("/add-server", (req, res) => {
  const { ip, name, admin, port } = req.body;
  const newServer = `${name}:${ip}:${admin}:${port}`;

  fs.appendFileSync("servers.txt", `\n${newServer}`); // Ajouter le serveur au fichier
  res.json({ name, ip, admin, port }); // Retourner le serveur ajouté
});

// Endpoint pour récupérer la liste des utilisateurs et des groupes d'un serveur
app.post("/users", async (req, res) => {
  const { ip, username, password, port } = req.body;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    // Récupérer les utilisateurs
    const result = await ssh.execCommand(
      "grep -E ':[0-9]{4,}:' /etc/passwd | grep -E ':/home/'"
    );
    const users = result.stdout
      .split("\n")
      .filter((user) => user.trim() !== "");

    // Récupérer les groupes
    const groupsWithHighGID = await getGroupsWithHighGID(ssh);
    const groupsWithUsers = await getGroupsWithUsers(ssh);

    const mergedGroups = mergeAndRemoveDuplicates(
      groupsWithHighGID,
      groupsWithUsers
    );

    res.json({ users, groups: mergedGroups });
  } catch (error) {
    res.status(500).json({ error: "Erreur de connexion SSH" });
  } finally {
    ssh.dispose();
  }
});

// Endpoint pour ajouter un utilisateur
app.post("/add-user", async (req, res) => {
  const { ip, port, username, password, newUser, newPassword } = req.body;

  if (!ip || !username || !password || !newUser || !newPassword) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires" });
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });
    const result = await ssh.execCommand(
      `echo '${password}' | sudo -S useradd -m -s /bin/bash ${newUser} && echo "${newUser}:${newPassword}" | sudo -S chpasswd`
    );

    const result2 = await ssh.execCommand(
      `echo '${password}' | sudo -S usermod -aG sudo,users ${newUser}`
    );

    if ((result.code === 0) & (result2.code === 0)) {
      res
        .status(200)
        .json({ success: true, message: "Utilisateur ajouté avec succès." });
    } else {
      // La commande a échoué
      throw new Error(result.stderr);
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'ajout de l'utilisateur" });
  } finally {
    ssh.dispose();
  }
});

// Endpoint pour supprimer un utilisateur
app.post("/delete-user", async (req, res) => {
  const { ip, username, password, port, userToDelete } = req.body;

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: ip, port, username, password });

    const command = `echo '${password}' | sudo -S userdel -r ${userToDelete}`;
    const result = await ssh.execCommand(command);

    // Vérifier si la commande a réussi
    if (result.code === 0) {
      res
        .status(200)
        .json({ success: true, message: "Utilisateur supprimé avec succès." });
    } else {
      // La commande a échoué
      throw new Error(result.stderr);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    ssh.dispose();
  }
});

app.listen(3000, () => console.log("Serveur en écoute sur le port 3000"));
